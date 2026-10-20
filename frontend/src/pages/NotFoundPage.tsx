import { SearchX } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={<SearchX className="size-7" />}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={<ButtonLink to="/explore">Explore tournaments</ButtonLink>}
      />
    </div>
  );
}
