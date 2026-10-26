import { useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppFooter } from '../components/AppFooter';
import { useAppearance } from '../features/appearance/useAppearance';
import { ConnectionBar } from '../features/connection/ConnectionBar';
import { useCollectionConnection } from '../features/connection/useCollectionConnection';
import type { CollectionSource } from '../features/connection/types';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { TodayScreen } from '../features/library/TodayScreen';
import { ReviewScreen } from '../features/review/ReviewScreen';
import { useDemoReview } from '../features/review/useDemoReview';
import { useNativeReview } from '../features/review/useNativeReview';
import { focusPage, useNavigation } from './navigation';

export function App() {
  const { page, navigate } = useNavigation();
  const { preference, setPreference, theme } = useAppearance();
  const { source, connection, selectSource, refresh } = useCollectionConnection();
  const [search, setSearch] = useState('');
  const review = useDemoReview(source === 'demo');
  const nativeReview = useNativeReview(refresh);

  const changeSource = (next: CollectionSource) => {
    if (next !== source) { setSearch(''); selectSource(next); }
  };
  const startReview = (deck: string) => {
    if (source === 'demo') review.start(deck);
    else if (connection.state === 'ready') void nativeReview.start(deck);
    else return;
    navigate('review');
  };

  return <>
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); focusPage(page); }}>Skip to content</a>
    <div className="app-shell">
      <AppHeader page={page} appearance={preference} onAppearanceChange={setPreference} />
      <ConnectionBar source={source} connection={connection} onSourceChange={changeSource} onRefresh={() => void refresh()} />
      <main id="main">
        <TodayScreen active={page === 'today'} source={source} connection={connection} onStart={startReview} />
        <LibraryScreen active={page === 'library'} source={source} connection={connection} search={search} onSearch={setSearch} onStart={startReview} />
        <ReviewScreen active={page === 'review'} source={source} connection={connection} review={review} nativeReview={nativeReview} />
      </main>
      <AppFooter source={source} connection={connection} theme={theme} />
    </div>
  </>;
}
