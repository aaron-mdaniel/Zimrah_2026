import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Trophy,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchInput } from '@/components/forms/SearchInput';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { resultService } from '@/services/resultService';
import { eventService } from '@/services/eventService';

export const ResultsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'published' | 'awaited'>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // 1. Fetch all 34 events
  const { data: eventsRes, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['public-events-list'],
    queryFn: () => eventService.getEvents({ pageSize: 100 }),
  });

  // 2. Fetch published results with 25s live polling
  const { data: publishedResults = [], isLoading: isLoadingResults } = useQuery({
    queryKey: ['public-published-results'],
    queryFn: () => resultService.getPublishedResults(),
    refetchInterval: 25000,
  });

  const events = eventsRes?.events || [];
  const publishedMap = new Map<string, typeof publishedResults[0]>();
  publishedResults.forEach((r) => {
    publishedMap.set(String(r.event_id), r);
  });

  const divisions = [
    { id: 'all', label: 'All Divisions' },
    { id: 'div_1', label: 'Div 1: Music' },
    { id: 'div_2', label: 'Div 2: Fine Arts' },
    { id: 'div_3', label: 'Div 3: Theater' },
    { id: 'div_4', label: 'Div 4: Writing & Elocution' },
  ];

  const combinedList = events.map((ev) => {
    const pub = publishedMap.get(String(ev.id));
    const isPublished = !!pub;
    const winnerEntry = pub?.entries?.find((e) => e.position === 1);

    return {
      id: String(ev.id),
      code: ev.code,
      name: ev.name,
      name_malayalam: ev.name_malayalam,
      category: ev.category?.name || 'Stage Event',
      division: ev.division?.name || 'General Division',
      division_id: ev.division_id,
      division_number: ev.division?.division_number,
      status: isPublished ? ('PUBLISHED' as const) : ('AWAITED' as const),
      winner: winnerEntry ? `${winnerEntry.participant_name} (#${winnerEntry.chest_number})` : null,
      winner_church: winnerEntry?.church?.name || null,
      published_at: pub?.published_at,
      entries: pub?.entries || [],
    };
  });

  const filteredResults = combinedList.filter((item) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'published' && item.status === 'PUBLISHED') ||
      (filter === 'awaited' && item.status === 'AWAITED');

    const matchesDivision =
      selectedDivision === 'all' ||
      item.division_id === selectedDivision ||
      (item.division_number && String(item.division_number) === selectedDivision.replace('div_', ''));

    const s = query.toLowerCase();
    const matchesQuery =
      !s ||
      item.code.toLowerCase().includes(s) ||
      item.name.toLowerCase().includes(s) ||
      (item.name_malayalam && item.name_malayalam.toLowerCase().includes(s)) ||
      item.entries.some(
        (e) =>
          e.chest_number.toLowerCase().includes(s) ||
          e.participant_name.toLowerCase().includes(s) ||
          (e.church?.name && e.church.name.toLowerCase().includes(s))
      );

    return matchesFilter && matchesDivision && matchesQuery;
  });

  const publishedCount = combinedList.filter((c) => c.status === 'PUBLISHED').length;

  const toggleExpand = (id: string) => {
    setExpandedEventId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Competition Results Directory"
        subtitle="Official verified scores and position points from the Diocesan Result Panel"
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <Tabs
            defaultValue="all"
            value={filter}
            onValueChange={(val) => setFilter(val as 'all' | 'published' | 'awaited')}
          >
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="all">All Events ({combinedList.length || 34})</TabsTrigger>
              <TabsTrigger value="published" className="text-emerald-700 font-bold">
                Published ({publishedCount})
              </TabsTrigger>
              <TabsTrigger value="awaited">Awaited ({combinedList.length - publishedCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="w-full sm:w-80">
            <SearchInput
              placeholder="Search chest # (e.g. 001), name, parish, or event..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery('')}
            />
          </div>
        </div>

        {/* Division Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span className="font-semibold text-slate-700 mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Division:
          </span>
          {divisions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDivision(d.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedDivision === d.id
                  ? 'bg-zim-primary text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      {isLoadingEvents || isLoadingResults ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" text="Loading official competition results..." />
        </div>
      ) : filteredResults.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No competition results match the selected filter"
          description={query ? `No events or contestants matched "${query}".` : 'No results found in this category.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredResults.map((r) => {
            const isExpanded = expandedEventId === r.id;
            const hasEntries = r.status === 'PUBLISHED' && r.entries.length > 0;

            return (
              <Card key={r.code} className="hover:border-slate-300 transition-colors overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <Badge variant="outline" className="font-mono font-bold text-zim-primary shrink-0">
                        {r.code}
                      </Badge>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 truncate">
                          <span>{r.name}</span>
                          {r.status === 'PUBLISHED' && (
                            <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500 mt-0.5">
                          {r.name_malayalam && (
                            <span className="font-malayalam text-slate-600">{r.name_malayalam}</span>
                          )}
                          <span>• {r.division}</span>
                          {r.winner && (
                            <span className="font-semibold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> 1st: {r.winner}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      {r.status === 'PUBLISHED' ? (
                        <Badge variant="success" className="gap-1 font-bold text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1 text-xs">
                          <Clock className="h-3 w-3" /> Result Awaited
                        </Badge>
                      )}

                      {hasEntries && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(r.id)}
                          className="h-8 px-2 text-xs text-slate-600 gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <span>Hide</span>
                              <ChevronUp className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              <span>Placed Roster</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </>
                          )}
                        </Button>
                      )}

                      <Button variant="secondary" size="sm" asChild className="gap-1 text-xs font-bold h-8">
                        <Link to={`/results/${r.code}`}>
                          <span>Scorecard</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Quick Preview Roster */}
                  {isExpanded && hasEntries && (
                    <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/70 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 p-4 sm:p-5">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Official Placed Contestants
                      </p>
                      <div className="space-y-1.5">
                        {r.entries.map((ent) => (
                          <div
                            key={ent.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-700 w-12">
                                {ent.position === 1 && <Badge className="bg-amber-500 text-white text-[10px]">1st</Badge>}
                                {ent.position === 2 && <Badge className="bg-slate-400 text-white text-[10px]">2nd</Badge>}
                                {ent.position === 3 && <Badge className="bg-amber-700 text-white text-[10px]">3rd</Badge>}
                                {!ent.position && <span className="text-slate-400">Placed</span>}
                              </span>
                              <span className="font-mono font-bold text-zim-primary">#{ent.chest_number}</span>
                              <span className="font-bold text-slate-900">{ent.participant_name}</span>
                              <span className="text-slate-500 truncate max-w-xs">{ent.church?.name}</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono">
                              {ent.grade && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-800">
                                  Grade {ent.grade}
                                </span>
                              )}
                              <span className="font-black text-zim-primary text-sm">
                                {Number(ent.total_points).toFixed(2)} pts
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
