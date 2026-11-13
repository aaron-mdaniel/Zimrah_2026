import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Eye, User, Sparkles, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { SearchInput } from '@/components/forms/SearchInput';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDebounce } from '@/hooks/useDebounce';
import {
  championshipService,
  IndividualEventBreakdownItem,
} from '@/services/championshipService';
import type { IndividualStanding } from '@/types';

export const IndividualLeaderboardPage: React.FC = () => {
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebounce(search, 250);

  const [selectedParticipant, setSelectedParticipant] = useState<IndividualStanding | null>(null);
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);

  // Live Query with 25s polling interval (ADR-008)
  const { data: standings = [], isLoading } = useQuery({
    queryKey: ['individual-standings', category, debouncedSearch],
    queryFn: () =>
      championshipService.getIndividualStandings(
        category,
        debouncedSearch,
        true // only_with_points = true for clean official leaderboard
      ),
    refetchInterval: 25000,
  });

  // Query for Individual Event Breakdown when modal is open
  const { data: breakdown = [], isLoading: isLoadingBreakdown } = useQuery<IndividualEventBreakdownItem[]>({
    queryKey: ['participant-breakdown', selectedParticipant?.participant_id],
    queryFn: () =>
      selectedParticipant
        ? championshipService.getParticipantBreakdown(String(selectedParticipant.participant_id))
        : Promise.resolve([]),
    enabled: !!selectedParticipant && breakdownModalOpen,
  });

  const openBreakdown = (p: IndividualStanding) => {
    setSelectedParticipant(p);
    setBreakdownModalOpen(true);
  };

  const topThree = standings.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        title="Individual Championship"
        subtitle="Contestant points leaderboard (Kalathilakam / Kalaprathibha) across Junior, Senior, and Overall divisions"
      >
        <div className="w-full sm:w-72">
          <SearchInput
            placeholder="Search chest #, name, parish..."
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
          <span className="font-bold text-zim-primary">Individual Scoring & Tie-Breaker Rules:</span>{' '}
          Contestant points aggregate all eligible individual and group events. Rank precedence: 1. Total Points &rarr; 2. 1st Places &rarr; 3. 2nd Places &rarr; 4. 3rd Places &rarr; 5. Grade A Awards.
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs defaultValue="ALL" value={category} onValueChange={setCategory}>
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="ALL" className="font-semibold">
            Overall Championship
          </TabsTrigger>
          <TabsTrigger value="JUNIOR" className="font-semibold">
            Junior Division
          </TabsTrigger>
          <TabsTrigger value="SENIOR" className="font-semibold">
            Senior Division
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Podium Display (Top 3 Individuals) */}
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
                  <h3 className="font-bold text-slate-900 mt-2 text-base line-clamp-1">{topThree[1].participant_name}</h3>
                  <p className="text-xs text-slate-500 font-semibold font-mono">
                    #{topThree[1].chest_number} • {topThree[1].church_name} ({topThree[1].church_code})
                  </p>
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

          {/* 1st Place (Gold / Titleholder) */}
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
                  <h3 className="font-extrabold text-slate-900 mt-2 text-lg line-clamp-1">{topThree[0].participant_name}</h3>
                  <p className="text-xs text-slate-600 font-semibold font-mono">
                    #{topThree[0].chest_number} • {topThree[0].church_name} ({topThree[0].church_code})
                  </p>
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
                  <h3 className="font-bold text-slate-900 mt-2 text-base line-clamp-1">{topThree[2].participant_name}</h3>
                  <p className="text-xs text-slate-500 font-semibold font-mono">
                    #{topThree[2].chest_number} • {topThree[2].church_name} ({topThree[2].church_code})
                  </p>
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

      {/* Complete Individual Standings Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-zim-gold" />
              Contestant Standings ({category === 'ALL' ? 'Overall' : category === 'JUNIOR' ? 'Junior' : 'Senior'})
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Click any contestant row to view individual competition score history</p>
          </div>
          <Badge variant="secondary" className="font-bold text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
            {standings.length} Contestants with Points
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex justify-center">
              <LoadingSpinner size="lg" text="Calculating individual standings..." />
            </div>
          ) : standings.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No contestants with points"
                description={debouncedSearch ? `No results matching "${debouncedSearch}".` : 'No individual points published yet.'}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/75 hover:bg-slate-50/75 text-xs">
                    <TableHead className="w-16 text-center font-bold">Rank</TableHead>
                    <TableHead className="w-20">Chest #</TableHead>
                    <TableHead>Contestant Name</TableHead>
                    <TableHead>Parish Church</TableHead>
                    <TableHead className="w-20 text-center">Division</TableHead>
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
                  {standings.map((p) => {
                    const isPodium = p.rank <= 3;
                    return (
                      <TableRow
                        key={String(p.participant_id)}
                        onClick={() => openBreakdown(p)}
                        className={`cursor-pointer transition-colors ${
                          p.rank === 1
                            ? 'bg-amber-50/40 hover:bg-amber-50/70 font-medium'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <TableCell className="text-center font-bold">
                          <div className="flex flex-col items-center justify-center">
                            <span
                              className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-black ${
                                p.rank === 1
                                  ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200'
                                  : p.rank === 2
                                  ? 'bg-slate-200 text-slate-800'
                                  : p.rank === 3
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'text-slate-600'
                              }`}
                            >
                              {p.rank}
                            </span>
                            {p.is_tied && (
                              <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider mt-0.5">
                                Tied
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-700">#{p.chest_number}</TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            {p.participant_name}
                            {p.rank === 1 && <Trophy className="h-3.5 w-3.5 text-zim-gold inline shrink-0" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {p.church_name} ({p.church_code})
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[11px] font-semibold">
                            {p.category_display || p.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{p.first_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{p.second_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{p.third_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{p.grade_a_count}</TableCell>
                        <TableCell className="text-center text-xs text-slate-500 hidden sm:table-cell">
                          {p.events_count}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-base font-black ${isPodium ? 'text-amber-950 font-black' : 'text-slate-900'}`}>
                            {Number(p.total_points).toFixed(2)}
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

      {/* Individual Event Breakdown Modal */}
      <Dialog open={breakdownModalOpen} onOpenChange={setBreakdownModalOpen}>
        <div className="space-y-4 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-zim-primary" />
              {selectedParticipant?.participant_name} (#{selectedParticipant?.chest_number})
            </DialogTitle>
            <DialogDescription>
              {selectedParticipant?.church_name} ({selectedParticipant?.church_code}) • {selectedParticipant?.category_display || selectedParticipant?.category} Division • {selectedParticipant?.total_points} total championship points.
            </DialogDescription>
          </DialogHeader>

          {isLoadingBreakdown ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" text="Loading contestant score contributions..." />
            </div>
          ) : breakdown.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No published points awarded to this contestant yet.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 text-xs">
                    <TableHead className="w-20">Event</TableHead>
                    <TableHead>Competition Name</TableHead>
                    <TableHead className="w-16 text-center">Pos</TableHead>
                    <TableHead className="w-16 text-center">Grade</TableHead>
                    <TableHead className="w-24">Role</TableHead>
                    <TableHead className="w-20 text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((item) => (
                    <TableRow key={item.ledger_id} className="text-xs">
                      <TableCell className="font-bold text-slate-900 font-mono">{item.event_code}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{item.event_name}</div>
                        {item.event_name_malayalam && (
                          <div className="text-[11px] text-slate-500">{item.event_name_malayalam}</div>
                        )}
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
                      <TableCell className="text-slate-500 text-[11px]">{item.role || '-'}</TableCell>
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
