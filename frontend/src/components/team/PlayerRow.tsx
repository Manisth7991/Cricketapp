import { memo } from 'react';
import { Pencil, Phone, Trash2 } from 'lucide-react';
import type { PlayerDTO } from '@playlocal/shared';
import { Avatar } from '@/components/ui/Avatar';

interface Props {
  player: PlayerDTO;
  index: number;
  onEdit?: (p: PlayerDTO) => void;
  onRemove?: (p: PlayerDTO) => void;
}

export const PlayerRow = memo(function PlayerRow({ player, index, onEdit, onRemove }: Props) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="w-5 text-right text-xs font-semibold text-ink-faint tabular">
        {index + 1}
      </span>
      <Avatar name={player.name} src={player.image} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{player.name}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
          {player.role && <span>{player.role}</span>}
          {player.phone && (
            <span className="flex items-center gap-1">
              <Phone className="size-3" aria-hidden />
              {player.phone}
            </span>
          )}
        </p>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(player)}
          className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-slate-100 hover:text-ink"
          aria-label={`Edit ${player.name}`}
        >
          <Pencil className="size-4" />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(player)}
          className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-red-50 hover:text-red-600"
          aria-label={`Remove ${player.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
});
