import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, ShieldCheck, Medal, Eye, Church as ChurchIcon, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { SearchInput } from '@/components/forms/SearchInput';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDebounce } from '@/hooks/useDebounce';
import {
  championshipService,
  ChurchEventBreakdownItem,
} from '@/services/championshipService';
import type { ChurchStanding } from '@/types';

export const ChurchLeaderboardPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const [selectedChurch, setSelectedChurch] = useState<ChurchStanding | null>(null);
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);

  // Live Query with 25s polling interval (ADR-008)
  const { data: standings = [], isLoading } = useQuery({
    queryKey: ['church-standings', debouncedSearch],
    queryFn: () => championshipService.getChurchStandings(undefined, debouncedSearch),
    refetchInterval: 25000,
  });

  // Query for Church Event Breakdown when modal is open
  const { data: breakdown = [], isLoading: isLoadingBreakdown } = useQuery<ChurchEventBreakdownItem[]>({
    queryKey: ['church-breakdown', selectedChurch?.church_id],
    queryFn: () =>
      selectedChurch ? championshipService.getChurchBreakdown(String(selectedChurch.church_id)) : Promise.resolve([]),
    enabled: !!selectedChurch && breakdownModalOpen,
  });

  const openBreakdown = (church: ChurchStanding) => {
    setSelectedChurch(church);
    setBreakdownModalOpen(true);
  };

  const topThree = standings.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Parish Church Championship"
        subtitle="Official diocesan parish points leaderboard computed with standard competition ranking and 5-level tie-breaker"
      >
        <div className="w-full sm:w-72">
          <SearchInput
            placeholder="Search parish or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
      </PageHeader>

      {/* Tie-breaker Rule Info Pill */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3.5 text-xs text-emerald-950 shadow-sm">
        <ShieldCheck className="h-5 w-5 text-zim-primary shrink-0" />
        <div>
          <span className="font-bold text-zim-primary">Authoritative 5-Level Tie-Breaker Precedence:</span>{' '}
          1. Total Points &rarr; 2. Count of 1st Places &rarr; 3. Count of 2nd Places &rarr; 4. Count of 3rd Places &rarr; 5. Count of Grade A Awards. Tied competitors share identical ranks using standard competition ranking.
        </div>
      </div>

      {/* Podium Display (Top 3 Churches) */}
      {!isLoading && standings.length >= 2 && !debouncedSearch && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* 2nd Place (Silver) */}
          {topThree[1] && (
            <Card className="order-2 md:order-1 border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-300" />
              <CardContent className="p-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-slate-200 text-slate-700 shadow-inner">
                  <Medal className="h-6 w-6" />
                </div>
                <div>
                  <Badge variant="outline" className="text-slate-600 font-bold border-slate-300">
                    2nd Position {topThree[1].is_tied && '(Tied)'}
                  </Badge>
                  <h3 className="font-bold text-slate-900 mt-2 text-base line-clamp-1">{topThree[1].church_name}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{topThree[1].church_code} • {topThree[1].church_location || 'Adoor District'}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-600">
                  <span><b className="text-slate-800">{topThree[1].first_places}</b> 1st</span>
                  <span>•</span>
                  <span><b className="text-slate-800">{topThree[1].second_places}</b> 2nd</span>
                  <span>•</span>
                  <span><b className="text-slate-800">{topThree[1].grade_a_count}</b> A</span>
                </div>
                <div className="pt-1">
                  <span className="text-3xl font-black text-slate-800">{Number(topThree[1].total_points).toFixed(2)}</span>
                  <span className="text-xs font-bold text-slate-500 ml-1">pts</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 1st Place (Gold / Champion) */}
          {topThree[0] && (
            <Card className="order-1 md:order-2 border-amber-300 bg-gradient-to-b from-amber-50/70 via-white to-amber-50/30 shadow-md hover:shadow-lg transition-shadow relative overflow-hidden transform md:-translate-y-2">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />
              <CardContent className="p-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-amber-100 text-amber-700 shadow-inner ring-4 ring-amber-50">
                  <Trophy className="h-7 w-7 text-amber-600" />
                </div>
                <div>
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-black shadow-sm gap-1">
                    <Sparkles className="h-3 w-3" />
                    Current Leader {topThree[0].is_tied && '(Tied)'}
                  </Badge>
                  <h3 className="font-extrabold text-slate-900 mt-2 text-lg line-clamp-1">{topThree[0].church_name}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{topThree[0].church_code} • {topThree[0].church_location || 'Adoor District'}</p>
                </div>
                <div className="pt-2 border-t border-amber-100/80 flex items-center justify-center gap-3 text-xs text-slate-700">
                  <span><b className="text-amber-900">{topThree[0].first_places}</b> 1st</span>
                  <span>•</span>
                  <span><b className="text-amber-900">{topThree[0].second_places}</b> 2nd</span>
                  <span>•</span>
                  <span><b className="text-amber-900">{topThree[0].grade_a_count}</b> A</span>
                </div>
                <div className="pt-1">
                  <span className="text-4xl font-black text-amber-950">{Number(topThree[0].total_points).toFixed(2)}</span>
                  <span className="text-xs font-bold text-amber-800 ml-1">pts</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3rd Place (Bronze) */}
          {topThree[2] && (
            <Card className="order-3 md:order-3 border-amber-200/80 bg-gradient-to-b from-orange-50/40 to-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-600" />
              <CardContent className="p-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 text-amber-800 shadow-inner">
                  <Medal className="h-6 w-6 text-amber-700" />
                </div>
                <div>
                  <Badge variant="outline" className="text-amber-800 font-bold border-amber-300">
                    3rd Position {topThree[2].is_tied && '(Tied)'}
                  </Badge>
                  <h3 className="font-bold text-slate-900 mt-2 text-base line-clamp-1">{topThree[2].church_name}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{topThree[2].church_code} • {topThree[2].church_location || 'Adoor District'}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-600">
                  <span><b className="text-slate-800">{topThree[2].first_places}</b> 1st</span>
                  <span>•</span>
                  <span><b className="text-slate-800">{topThree[2].second_places}</b> 2nd</span>
                  <span>•</span>
                  <span><b className="text-slate-800">{topThree[2].grade_a_count}</b> A</span>
                </div>
                <div className="pt-1">
                  <span className="text-3xl font-black text-slate-800">{Number(topThree[2].total_points).toFixed(2)}</span>
                  <span className="text-xs font-bold text-slate-500 ml-1">pts</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Complete Standings Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-zim-gold" />
              Parish Championship Standings
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Click any parish row to inspect event-wise point contributions</p>
          </div>
          <Badge variant="secondary" className="font-bold text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
            Adoor Clergy District (8 Parishes)
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <LoadingSpinner size="lg" text="Calculating official championship standings..." />
            </div>
          ) : standings.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No parishes found"
                description={debouncedSearch ? `No results matching "${debouncedSearch}".` : 'No church standings records available.'}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/75 hover:bg-slate-50/75 text-xs">
                    <TableHead className="w-16 text-center font-bold">Rank</TableHead>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Parish Church</TableHead>
                    <TableHead className="hidden md:table-cell">Clergy District</TableHead>
                    <TableHead className="text-center w-16">1st</TableHead>
                    <TableHead className="text-center w-16">2nd</TableHead>
                    <TableHead className="text-center w-16">3rd</TableHead>
                    <TableHead className="text-center w-16">Grade A</TableHead>
                    <TableHead className="text-center w-20 hidden sm:table-cell">Events</TableHead>
                    <TableHead className="text-right w-28 font-bold">Total Points</TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((c) => {
                    const isPodium = c.rank <= 3;
                    return (
                      <TableRow
                        key={String(c.church_id)}
                        onClick={() => openBreakdown(c)}
                        className={`cursor-pointer transition-colors ${
                          c.rank === 1
                            ? 'bg-amber-50/40 hover:bg-amber-50/70 font-medium'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <TableCell className="text-center font-bold">
                          <div className="flex flex-col items-center justify-center">
                            <span
                              className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-black ${
                                c.rank === 1
                                  ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200'
                                  : c.rank === 2
                                  ? 'bg-slate-200 text-slate-800'
                                  : c.rank === 3
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'text-slate-600'
                              }`}
                            >
                              {c.rank}
                            </span>
                            {c.is_tied && (
                              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider mt-0.5">
                                Tied
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-600">{c.church_code}</TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            {c.church_name}
                            {c.rank === 1 && <Trophy className="h-3.5 w-3.5 text-zim-gold inline shrink-0" />}
                          </div>
                          <div className="text-xs text-slate-400 md:hidden mt-0.5">{c.church_location}</div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 hidden md:table-cell">
                          {c.church_location || 'Adoor Clergy District'}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{c.first_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{c.second_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{c.third_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{c.grade_a_count}</TableCell>
                        <TableCell className="text-center text-xs text-slate-500 hidden sm:table-cell">
                          {c.events_count}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-base font-black ${isPodium ? 'text-amber-950 font-black' : 'text-slate-900'}`}>
                            {Number(c.total_points).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Eye className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Church Event Breakdown Modal */}
      <Dialog open={breakdownModalOpen} onOpenChange={setBreakdownModalOpen}>
        <div className="space-y-4 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ChurchIcon className="h-5 w-5 text-zim-primary" />
              {selectedChurch?.church_name} ({selectedChurch?.church_code})
            </DialogTitle>
            <DialogDescription>
              Detailed competition point allocations contributing to {selectedChurch?.total_points} total parish points.
            </DialogDescription>
          </DialogHeader>

          {isLoadingBreakdown ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" text="Loading parish score contributions..." />
            </div>
          ) : breakdown.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No published points awarded to this parish church yet.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 text-xs">
                    <TableHead className="w-20">Event</TableHead>
                    <TableHead>Contestant / Team</TableHead>
                    <TableHead className="w-16 text-center">Pos</TableHead>
                    <TableHead className="w-16 text-center">Grade</TableHead>
                    <TableHead className="w-20 text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((item) => (
                    <TableRow key={item.ledger_id} className="text-xs">
                      <TableCell className="font-bold text-slate-900">
                        {item.event_code}
                        <div className="text-[11px] font-normal text-slate-500 truncate max-w-[130px]">{item.event_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{item.participant_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">#{item.chest_number}</div>
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {item.position ? (
                          <Badge variant="outline" className="text-[11px] font-bold">
                            {item.position === 1 ? '1st' : item.position === 2 ? '2nd' : '3rd'}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-700">{item.grade || '-'}</TableCell>
                      <TableCell className="text-right font-black text-slate-900">
                        +{Number(item.points).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};
