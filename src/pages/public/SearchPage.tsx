import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Music,
  Church,
  Users,
  Award,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/forms/SearchInput';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import { eventService } from '@/services/eventService';
import { churchService } from '@/services/churchService';
import { participantService } from '@/services/participantService';
import { resultService } from '@/services/resultService';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const debouncedSearch = useDebounce(searchTerm.trim(), 300);

  useEffect(() => {
    if (debouncedSearch) {
      setSearchParams({ q: debouncedSearch });
    } else {
      setSearchParams({});
    }
  }, [debouncedSearch, setSearchParams]);

  // 1. Search Competitions
  const { data: eventsData, isLoading: loadingEvents } = useQuery({
    queryKey: ['search-events', debouncedSearch],
    queryFn: () => eventService.getEvents({ search: debouncedSearch, pageSize: 6 }),
    enabled: debouncedSearch.length >= 2,
  });

  // 2. Search Churches
  const { data: churchesData, isLoading: loadingChurches } = useQuery({
    queryKey: ['search-churches', debouncedSearch],
    queryFn: () => churchService.getChurches({ search: debouncedSearch, pageSize: 6 }),
    enabled: debouncedSearch.length >= 2,
  });

  // 3. Search Participants (Strict string chest numbers!)
  const { data: participantsData, isLoading: loadingParticipants } = useQuery({
    queryKey: ['search-participants', debouncedSearch],
    queryFn: () => participantService.getParticipants({ search: debouncedSearch, pageSize: 6 }),
    enabled: debouncedSearch.length >= 2,
  });

  // 4. Search Published Results
  const { data: publishedResults = [] } = useQuery({
    queryKey: ['search-published-results'],
    queryFn: () => resultService.getPublishedResults(),
    enabled: debouncedSearch.length >= 2,
  });

  const matchingEvents = eventsData?.events || [];
  const matchingChurches = churchesData?.churches || [];
  const matchingParticipants = participantsData?.participants || [];

  const matchingResults = publishedResults.filter((r) => {
    const s = debouncedSearch.toLowerCase();
    const matchEvent =
      (r.event?.name && r.event.name.toLowerCase().includes(s)) ||
      (r.event?.code && r.event.code.toLowerCase().includes(s));
    const matchEntry = r.entries?.some(
      (e) =>
        e.chest_number.toLowerCase().includes(s) ||
        e.participant_name.toLowerCase().includes(s) ||
        (e.church?.name && e.church.name.toLowerCase().includes(s))
    );
    return matchEvent || matchEntry;
  });

  const isSearching = loadingEvents || loadingChurches || loadingParticipants;
  const hasResults =
    matchingEvents.length > 0 ||
    matchingChurches.length > 0 ||
    matchingParticipants.length > 0 ||
    matchingResults.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Unified Kalolsavam Search"
        subtitle="Search across contestant chest numbers, participant names, churches, and competitions"
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <SearchInput
          placeholder="Search by chest number (e.g. 001), name, parish, or event..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          className="text-base py-3"
          autoFocus
        />
      </div>

      {debouncedSearch.length < 2 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Enter a query to begin search</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try searching for chest numbers like "001", participant names, or competition titles. Minimum 2 characters.
          </p>
        </div>
      ) : isSearching ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="md" text={`Searching across all records for "${debouncedSearch}"...`} />
        </div>
      ) : !hasResults ? (
        <EmptyState
          icon={Search}
          title="No records found"
          description={`No competitions, churches, or contestants matched "${debouncedSearch}".`}
        />
      ) : (
        <div className="space-y-6">
          {/* Published Results Matching Query */}
          {matchingResults.length > 0 && (
            <Card className="border-emerald-200 shadow-xs">
              <CardHeader className="pb-3 bg-emerald-50/50 rounded-t-xl border-b border-emerald-100">
                <CardTitle className="text-base flex items-center justify-between text-emerald-950 font-bold">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-zim-primary" />
                    <span>Official Scorecards ({matchingResults.length})</span>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    PUBLISHED
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100">
                {matchingResults.map((res) => (
                  <div key={res.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-xs font-bold text-zim-primary">
                          {res.event?.code}
                        </Badge>
                        <span className="font-bold text-sm text-slate-900">{res.event?.name}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {res.entries?.length || 0} contestants awarded • Published{' '}
                        {res.published_at ? new Date(res.published_at).toLocaleDateString() : 'Official'}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="secondary" className="gap-1 font-bold text-xs">
                      <Link to={`/results/${res.event?.code}`}>
                        View Scorecard <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Matching Competitions */}
          {matchingEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2 text-slate-900 font-bold">
                  <Music className="h-4 w-4 text-zim-primary" />
                  Matching Competitions ({matchingEvents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100">
                {matchingEvents.map((ev) => (
                  <div key={ev.id || ev.code} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-xs font-bold text-zim-primary">
                          {ev.code}
                        </Badge>
                        <span className="font-bold text-sm text-slate-900">{ev.name}</span>
                      </div>
                      <p className="text-xs text-slate-500 font-malayalam">
                        {ev.name_malayalam} • Division: {ev.division?.name || 'General'}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-1 font-bold text-xs">
                      <Link to={`/results/${ev.code}`}>
                        Scorecard <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Matching Participants */}
          {matchingParticipants.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2 text-slate-900 font-bold">
                  <Users className="h-4 w-4 text-blue-600" />
                  Matching Contestants ({matchingParticipants.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100">
                {matchingParticipants.map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-mono font-black text-sm shrink-0 border border-blue-200">
                        #{p.chest_number}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.name_malayalam && (
                            <span className="text-xs font-normal text-slate-500 font-malayalam">({p.name_malayalam})</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {p.church?.name} • Category: {p.age_category} • Gender: {p.gender}
                        </p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="gap-1 text-xs text-zim-primary font-bold">
                      <Link to="/championship/individual">
                        Standings <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Matching Churches */}
          {matchingChurches.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2 text-slate-900 font-bold">
                  <Church className="h-4 w-4 text-emerald-600" />
                  Matching Churches ({matchingChurches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100">
                {matchingChurches.map((c) => (
                  <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-xs font-bold text-slate-700">
                          {c.code}
                        </Badge>
                        <span className="font-bold text-sm text-slate-900">{c.name}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {c.name_malayalam && `${c.name_malayalam} • `}{c.district}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="gap-1 text-xs text-zim-primary font-bold">
                      <Link to="/championship/church">
                        Leaderboard <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
