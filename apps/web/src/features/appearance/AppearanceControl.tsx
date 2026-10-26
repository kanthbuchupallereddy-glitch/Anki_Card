import type { AppearancePreference } from './useAppearance';

export function AppearanceControl({ preference, onChange }: {
  preference: AppearancePreference;
  onChange: (value: AppearancePreference) => void;
}) {
  return <div className="appearance" role="group" aria-label="Appearance">
    {(['light', 'dark', 'system'] as const).map(value =>
      <button key={value} type="button" data-theme-choice={value} aria-pressed={preference === value} onClick={() => onChange(value)}>
        {value[0]!.toUpperCase() + value.slice(1)}
      </button>)}
  </div>;
}
