import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, RefreshCw, Zap, ShieldCheck, User, Church as ChurchIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/useToast';
import { championshipService } from '@/services/championshipService';
import { cacheService } from '@/services/cacheService';
import { supabase } from '@/lib/supabase';

interface RawLedgerEntry {
  id: string;
  target: 'CHURCH' | 'INDIVIDUAL';
  points: number;
  is_active: boolean;
  created_at: string;
  church: { code: string; name: string };
  participant?: { chest_number: string; name: string };
  event: { code: string; name: string };
}

export const ChampionshipsAdminPage: React.FC = () => {
  const [tab, setTab] = useState<'church' | 'individual' | 'ledger'>('church');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries
  const { data: churchStandings = [], isLoading: isLoadingChurches } = useQuery({
    queryKey: ['admin-church-standings'],
    queryFn: () => championshipService.getChurchStandings(),
  });

  const { data: indStandings = [], isLoading: isLoadingInd } = useQuery({
    queryKey: ['admin-individual-standings'],
    queryFn: () => championshipService.getIndividualStandings('ALL', '', false),
  });

  const { data: ledgerEntries = [], isLoading: isLoadingLedger } = useQuery<RawLedgerEntry[]>({
    queryKey: ['admin-raw-point-ledger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('point_ledger')
        .select(`
          id,
          target,
          points,
          is_active,
          created_at,
          church:churches(code, name),
          participant:participants(chest_number, name),
          event:events(code, name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.warn('Raw ledger query error:', error);
        return [];
      }
      return (data || []) as unknown as RawLedgerEntry[];
    },
    enabled: tab === 'ledger',
  });

  const handleRecalculate = async () => {
    await cacheService.invalidateAll(undefined, 'MANUAL_RECALCULATE').catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['admin-church-standings'] });
    queryClient.invalidateQueries({ queryKey: ['admin-individual-standings'] });
    queryClient.invalidateQueries({ queryKey: ['admin-raw-point-ledger'] });
    queryClient.invalidateQueries({ queryKey: ['church-standings'] });
    queryClient.invalidateQueries({ queryKey: ['individual-standings'] });
    queryClient.invalidateQueries({ queryKey: ['live-summary'] });
    toast.success('Championship leaderboards and point ledgers recalculated successfully.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Championship Ledger & Leaderboard Engine"
        subtitle="Review active point ledger allocations and monitor 5-level tie-breaking rank calculations"
      >
        <Button variant="outline" onClick={handleRecalculate} className="gap-2 shadow-sm">
          <RefreshCw className="h-4 w-4" /> Recalculate Standings
        </Button>
      </PageHeader>

      {/* Tie-breaker Rule Info Banner */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-emerald-950">
        <ShieldCheck className="h-5 w-5 text-zim-primary shrink-0" />
        <div>
          <span className="font-bold text-zim-primary">Standard Competition Ranking (1, 2, 2, 4):</span> Precedence hierarchy evaluates 1. Total Points &rarr; 2. 1st Places &rarr; 3. 2nd Places &rarr; 4. 3rd Places &rarr; 5. Grade A. Tied entities share ranks; deterministic order uses name/chest number.
        </div>
      </div>

      <Tabs value={tab} onValueChange={(val) => setTab(val as 'church' | 'individual' | 'ledger')} defaultValue="church">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="church">Parish Church Standings</TabsTrigger>
          <TabsTrigger value="individual">Individual Contestant Standings</TabsTrigger>
          <TabsTrigger value="ledger">Point Ledger Audit (Raw Records)</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Parish Standings */}
      {tab === 'church' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ChurchIcon className="h-4 w-4 text-zim-primary" />
              Parish Church Championship Standings
            </CardTitle>
            <Badge variant="secondary" className="gap-1 font-bold text-xs">
              <Zap className="h-3 w-3 text-amber-500" /> Live PostgreSQL RPC Engine Active
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingChurches ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="md" text="Loading parish standings..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-xs">
                      <TableHead className="w-16 text-center">Rank</TableHead>
                      <TableHead>Parish Church</TableHead>
                      <TableHead className="text-center w-20">1st Places</TableHead>
                      <TableHead className="text-center w-20">2nd Places</TableHead>
                      <TableHead className="text-center w-20">3rd Places</TableHead>
                      <TableHead className="text-center w-20">Grade A</TableHead>
                      <TableHead className="text-center w-20">Events</TableHead>
                      <TableHead className="text-right w-28 font-bold">Total Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {churchStandings.map((c) => (
                      <TableRow key={String(c.church_id)} className="text-xs">
                        <TableCell className="text-center font-bold">
                          <span
                            className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                              c.rank === 1
                                ? 'bg-amber-400 text-amber-950'
                                : c.rank === 2
                                ? 'bg-slate-200 text-slate-800'
                                : c.rank === 3
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-600'
                            }`}
                          >
                            {c.rank}
                          </span>
                          {c.is_tied && <div className="text-[10px] text-amber-600 font-bold">Tied</div>}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900">{c.church_name}</div>
                          <div className="text-[11px] text-slate-500">{c.church_code} • {c.church_location}</div>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{c.first_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{c.second_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{c.third_places}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-800">{c.grade_a_count}</TableCell>
                        <TableCell className="text-center text-slate-500">{c.events_count}</TableCell>
                        <TableCell className="text-right font-black text-slate-900 text-sm">
                          {Number(c.total_points).toFixed(2)} pts
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual Standings */}
      {tab === 'individual' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-zim-primary" />
              Individual Contestant Standings (Kalathilakam / Kalaprathibha)
            </CardTitle>
            <Badge variant="secondary" className="gap-1 font-bold text-xs">
              <Trophy className="h-3 w-3 text-zim-gold" /> {indStandings.length} Total Contestants
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingInd ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="md" text="Loading contestant standings..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-xs">
                      <TableHead className="w-16 text-center">Rank</TableHead>
                      <TableHead className="w-20">Chest #</TableHead>
                      <TableHead>Contestant Name</TableHead>
                      <TableHead>Parish Church</TableHead>
                      <TableHead className="text-center w-24">Category</TableHead>
                      <TableHead className="text-center w-16">1st</TableHead>
                      <TableHead className="text-center w-16">2nd</TableHead>
                      <TableHead className="text-center w-16">3rd</TableHead>
                      <TableHead className="text-center w-16">Grade A</TableHead>
                      <TableHead className="text-right w-28 font-bold">Total Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indStandings.map((p) => (
                      <TableRow key={String(p.participant_id)} className="text-xs">
                        <TableCell className="text-center font-bold">
                          <span
                            className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                              p.rank === 1
                                ? 'bg-amber-400 text-amber-950'
                                : p.rank === 2
                                ? 'bg-slate-200 text-slate-800'
                                : p.rank === 3
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-600'
                            }`}
                          >
                            {p.rank}
                          </span>
                          {p.is_tied && <div className="text-[10px] text-amber-600 font-bold">Tied</div>}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-slate-700">#{p.chest_number}</TableCell>
                        <TableCell className="font-bold text-slate-900">{p.participant_name}</TableCell>
                        <TableCell className="text-slate-600">{p.church_name} ({p.church_code})</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px]">{p.category_display || p.category}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{p.first_places}</TableCell>
                        <TableCell className="text-center font-semibold">{p.second_places}</TableCell>
                        <TableCell className="text-center font-semibold">{p.third_places}</TableCell>
                        <TableCell className="text-center font-semibold">{p.grade_a_count}</TableCell>
                        <TableCell className="text-right font-black text-slate-900 text-sm">
                          {Number(p.total_points).toFixed(2)} pts
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Point Ledger Audit */}
      {tab === 'ledger' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-zim-primary" />
              Latest 50 Point Ledger Records
            </CardTitle>
            <Badge variant="outline" className="text-xs font-bold">
              public.point_ledger
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingLedger ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="md" text="Loading ledger entries..." />
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No point ledger entries recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-xs">
                      <TableHead className="w-20">Target</TableHead>
                      <TableHead className="w-24">Event</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead className="text-right w-24">Points</TableHead>
                      <TableHead className="text-center w-24">Status</TableHead>
                      <TableHead className="text-right w-36">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries.map((l) => (
                      <TableRow key={l.id} className="text-xs">
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] font-bold ${
                              l.target === 'CHURCH' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {l.target}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-slate-800">
                          {l.event?.code}
                        </TableCell>
                        <TableCell>
                          {l.target === 'CHURCH' ? (
                            <span className="font-bold text-slate-900">{l.church?.name} ({l.church?.code})</span>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-900">{l.participant?.name}</span>
                              <span className="text-slate-500 font-mono ml-1.5">#{l.participant?.chest_number}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-black text-slate-900">
                          +{Number(l.points).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          {l.is_active ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-bold">ACTIVE</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 text-[10px]">DEACTIVATED</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-slate-500 text-[11px]">
                          {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
