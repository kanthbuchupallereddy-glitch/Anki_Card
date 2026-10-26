import type { Page } from '../app/navigation';
import { AppearanceControl } from '../features/appearance/AppearanceControl';
import type { AppearancePreference } from '../features/appearance/useAppearance';

export function AppHeader({ page, appearance, onAppearanceChange }: {
  page: Page; appearance: AppearancePreference; onAppearanceChange: (value: AppearancePreference) => void;
}) {
  return <header className="app-header">
    <a className="wordmark" href="#today" aria-label="Study home">Study<span>.</span></a>
    <nav className="main-nav" aria-label="Main navigation">
      {(['today', 'library', 'review'] as const).map(value => <a key={value} href={`#${value}`} data-page={value} aria-current={page === value ? 'page' : undefined}>{value[0]!.toUpperCase() + value.slice(1)}</a>)}
    </nav>
    <AppearanceControl preference={appearance} onChange={onAppearanceChange} />
  </header>;
}
