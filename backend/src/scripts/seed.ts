/**
 * Seeds reference data, and optionally demo data.
 *
 *   npm run seed            → sports + admin accounts (from ADMIN_PHONES). Safe to re-run (idempotent).
 *   npm run seed -- --demo  → also realistic DEMO users/teams/tournaments for local testing.
 *
 * Demo data is only for development/demos — never run --demo against production.
 */
import { slugify } from '@playlocal/shared';
import { env, isProd } from '../config/env';
import { connectDb, disconnectDb } from '../config/db';
import { Registration, Sport, Team, Tournament, User } from '../models';
import { syncAdmins } from '../services/adminAccounts';
import { endOfDay, startOfDay, todayIso } from '../utils/dates';

const SPORTS = [
  { name: 'Cricket', icon: '🏏' },
  { name: 'Football', icon: '⚽' },
  { name: 'Kabaddi', icon: '🤼' },
  { name: 'Volleyball', icon: '🏐' },
  { name: 'Badminton', icon: '🏸' },
  { name: 'Hockey', icon: '🏑' },
  { name: 'Basketball', icon: '🏀' },
  { name: 'Kho-Kho', icon: '🏃' },
  { name: 'Table Tennis', icon: '🏓' },
];

async function seedSports() {
  await Promise.all(
    SPORTS.map((s, i) =>
      Sport.updateOne(
        { slug: slugify(s.name) },
        {
          $setOnInsert: {
            name: s.name,
            slug: slugify(s.name),
            icon: s.icon,
            active: true,
            order: (i + 1) * 10,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

const day = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return todayIso(d);
};

async function seedDemo() {
  const users = await Promise.all(
    [
      {
        name: 'Rakesh Choudhary',
        email: 'rakesh@demo.playlocal',
        phone: '9000000101',
        location: { city: 'Sikar', state: 'Rajasthan' },
      },
      {
        name: 'Anjali Patil',
        email: 'anjali@demo.playlocal',
        phone: '9000000102',
        location: { city: 'Pune', state: 'Maharashtra' },
      },
      {
        name: 'Gurpreet Singh',
        email: 'gurpreet@demo.playlocal',
        phone: '9000000103',
        location: { city: 'Ludhiana', state: 'Punjab' },
      },
      {
        name: 'Imran Khan',
        email: 'imran@demo.playlocal',
        phone: '9000000104',
        location: { city: 'Lucknow', state: 'Uttar Pradesh' },
      },
    ].map((u) =>
      User.findOneAndUpdate(
        { email: u.email },
        {
          $setOnInsert: {
            ...u,
            phoneVerifiedAt: new Date(),
            role: 'user',
            status: 'active',
            location: { ...u.location, country: 'India' },
          },
        },
        { upsert: true, returnDocument: 'after' },
      ).lean(),
    ),
  );
  const [rakesh, anjali, gurpreet, imran] = users.map((u) => u!) as [
    NonNullable<(typeof users)[number]>,
    NonNullable<(typeof users)[number]>,
    NonNullable<(typeof users)[number]>,
    NonNullable<(typeof users)[number]>,
  ];

  if (await Tournament.exists({ name: 'Sikar Premier League' })) {
    console.log('Demo data already present — skipping.');
    return;
  }

  const point = (lat: number, lng: number) => ({ type: 'Point', coordinates: [lng, lat] });
  const base = { verifiedAt: new Date(), submittedAt: new Date(), allowWaitlist: true };
  const T = (o: {
    name: string;
    sport: string;
    organizer: { _id: unknown };
    venue: {
      name: string;
      address: string;
      city: string;
      state: string;
      location?: ReturnType<typeof point>;
    };
    start: number;
    days?: number;
    deadline: number;
    maxTeams: number;
    entryFee: number;
    prizeMoney: number;
    status?: string;
    prizeDetails?: string;
    description: string;
    rules: string[];
  }) => ({
    ...base,
    name: o.name,
    sport: o.sport,
    organizerId: o.organizer._id,
    venue: o.venue,
    startDate: startOfDay(day(o.start)),
    endDate: endOfDay(day(o.start + (o.days ?? 1) - 1)),
    registrationDeadline: endOfDay(day(o.deadline)),
    maxTeams: o.maxTeams,
    entryFee: o.entryFee,
    prizeMoney: o.prizeMoney,
    prizeDetails: o.prizeDetails,
    description: o.description,
    rules: o.rules,
    status: o.status ?? 'published',
  });

  const tournaments = await Tournament.insertMany([
    T({
      name: 'Sikar Premier League',
      sport: 'cricket',
      organizer: rakesh,
      venue: {
        name: 'Shri Kalyan Stadium',
        address: 'Jaipur Road, near Bajaj Gram',
        city: 'Sikar',
        state: 'Rajasthan',
        location: point(27.6094, 75.1399),
      },
      start: 14,
      days: 5,
      deadline: 10,
      maxTeams: 16,
      entryFee: 1100,
      prizeMoney: 51000,
      prizeDetails: 'Winner ₹31,000 + trophy · Runner-up ₹15,000 · Man of the series ₹5,000',
      description:
        'The biggest tennis-ball cricket tournament of the Shekhawati region is back! 16 teams, 10-over matches under lights for the semi-finals and final. Teams from Sikar, Jhunjhunu and Churu districts are welcome.',
      rules: [
        '10 overs per innings, 2 powerplay overs',
        'Tennis ball (heavy) provided by organisers',
        'Maximum 15 players per squad',
        'Umpire decision is final',
      ],
    }),
    T({
      name: 'Shekhawati Kabaddi Dangal',
      sport: 'kabaddi',
      organizer: rakesh,
      venue: {
        name: 'Govt Senior Secondary School Ground',
        address: 'Village Palsana',
        city: 'Palsana',
        state: 'Rajasthan',
        location: point(27.5167, 75.3333),
      },
      start: 21,
      days: 2,
      deadline: 18,
      maxTeams: 12,
      entryFee: 500,
      prizeMoney: 21000,
      description:
        'Traditional mat kabaddi tournament open to village teams. Weight limit 75 kg per player.',
      rules: ['Standard Pro Kabaddi rules', 'Weight limit 75 kg', 'Squad of 10 players'],
    }),
    T({
      name: 'Pune Monsoon Football Cup',
      sport: 'football',
      organizer: anjali,
      venue: {
        name: 'Shivaji Nagar Police Ground',
        address: 'FC Road, Shivajinagar',
        city: 'Pune',
        state: 'Maharashtra',
        location: point(18.5308, 73.8475),
      },
      start: 9,
      days: 3,
      deadline: 5,
      maxTeams: 8,
      entryFee: 2500,
      prizeMoney: 40000,
      description:
        '7-a-side football for amateur clubs and college teams. Turf ground, floodlit matches every evening.',
      rules: ['7-a-side, rolling substitutions', '20-minute halves', 'Studs not allowed on turf'],
    }),
    T({
      name: 'Ludhiana Hockey Classic',
      sport: 'hockey',
      organizer: gurpreet,
      venue: {
        name: 'Guru Nanak Stadium',
        address: 'Pakhowal Road',
        city: 'Ludhiana',
        state: 'Punjab',
        location: point(30.8945, 75.8303),
      },
      start: 30,
      days: 4,
      deadline: 24,
      maxTeams: 10,
      entryFee: 1500,
      prizeMoney: 75000,
      description:
        'Open hockey championship for clubs and academies across Punjab. Astro-turf matches.',
      rules: ['FIH rules apply', 'Players must carry ID proof', 'Squad of 16'],
    }),
    T({
      name: 'Lucknow Volleyball Night League',
      sport: 'volleyball',
      organizer: imran,
      venue: {
        name: 'KD Singh Babu Stadium',
        address: 'Hazratganj',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        location: point(26.8506, 80.9462),
      },
      start: 6,
      days: 2,
      deadline: 3,
      maxTeams: 8,
      entryFee: 800,
      prizeMoney: 15000,
      description: 'Floodlit volleyball league for local clubs and colleges.',
      rules: ['Best of 3 sets', '6 players + 4 substitutes'],
    }),
    T({
      name: 'Jhunjhunu Village Cricket Trophy',
      sport: 'cricket',
      organizer: rakesh,
      venue: {
        name: 'Nehru Stadium',
        address: 'Station Road',
        city: 'Jhunjhunu',
        state: 'Rajasthan',
        location: point(28.1289, 75.3995),
      },
      start: 40,
      days: 7,
      deadline: 32,
      maxTeams: 24,
      entryFee: 700,
      prizeMoney: 35000,
      description:
        'A week-long village-level cricket festival. Only teams registered from villages in Jhunjhunu district.',
      rules: ['8 overs per innings', 'Players must be residents of the district'],
      status: 'pending_verification',
    }),
  ]);

  const teams = await Team.insertMany([
    {
      name: 'Palsana Panthers',
      sport: 'cricket',
      captainId: rakesh._id,
      location: { city: 'Palsana', state: 'Rajasthan' },
      players: [
        'Mahesh',
        'Sunil',
        'Vikram',
        'Ramesh',
        'Dinesh',
        'Ajay',
        'Pawan',
        'Kailash',
        'Manoj',
        'Sanjay',
        'Hemant',
      ].map((n, i) => ({
        name: `${n} ${['Jat', 'Saini', 'Meena'][i % 3]}`,
        role: i === 0 ? 'Captain' : i < 5 ? 'Batter' : 'Bowler',
      })),
    },
    {
      name: 'Deccan Strikers FC',
      sport: 'football',
      captainId: anjali._id,
      location: { city: 'Pune', state: 'Maharashtra' },
      players: ['Rohan', 'Aditya', 'Siddharth', 'Omkar', 'Tejas', 'Yash', 'Pranav'].map((n) => ({
        name: `${n} Kulkarni`,
      })),
    },
    {
      name: 'Lucknow Spikers',
      sport: 'volleyball',
      captainId: imran._id,
      location: { city: 'Lucknow', state: 'Uttar Pradesh' },
      players: ['Faizan', 'Arjun', 'Rahul', 'Zaid', 'Kunal', 'Nitin'].map((n) => ({ name: n })),
    },
  ]);

  const [spl] = tournaments;
  await Registration.create({
    tournamentId: spl!._id,
    teamId: teams[0]!._id,
    captainId: rakesh._id,
    status: 'confirmed',
  });
  await Tournament.updateOne({ _id: spl!._id }, { $set: { registeredCount: 1 } });

  console.log(
    `Demo data created. Sign in with phone 9000000101 (organiser) — or 9000000102/103/104 — the OTP is printed in the API terminal when SMS_PROVIDER=console.`,
  );
}

const demo = process.argv.includes('--demo');
if (demo && isProd) throw new Error('Refusing to seed demo data in production.');

await connectDb();
await seedSports();

console.log('✓ Sports seeded');
const admins = await syncAdmins();

console.log(
  env.ADMIN_PHONES.length
    ? `✓ Admins synced (${env.ADMIN_PHONES.join(', ')}): created ${admins.created.length}, promoted ${admins.promoted.length}, demoted ${admins.demoted}`
    : '• ADMIN_PHONES not set — no admin accounts',
);
if (demo) await seedDemo();
await disconnectDb();
