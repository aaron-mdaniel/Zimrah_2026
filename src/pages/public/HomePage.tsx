import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy,
  Award,
  Music,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Search,
  Calendar,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { championshipService } from '@/services/championshipService';
import { resultService } from '@/services/resultService';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Live Summary query with 25s polling (ADR-008)
  const { data: summary } = useQuery({
    queryKey: ['live-summary'],
    queryFn: () => championshipService.getLiveSummary(),
    refetchInterval: 25000,
  });

  // 2. Published Results query
  const { data: publishedResults = [] } = useQuery({
    queryKey: ['home-published-results'],
    queryFn: () => resultService.getPublishedResults(),
    refetchInterval: 25000,
  });

  const leadingChurch = summary?.top_churches?.[0];
  const leadingIndividual = summary?.top_individuals?.[0];
  const topChurches = summary?.top_churches?.slice(0, 3) || [];
  const topIndividuals = summary?.top_individuals?.slice(0, 3) || [];
  const latestPublished = publishedResults.slice(0, 4);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="space-y-12 pb-8">
      {/* Hero Banner Section with Search */}
      <section className="relative overflow-hidden bg-gradient-to-br from-zim-primary-dark via-zim-primary to-emerald-950 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-emerald-800 shadow-xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <Badge variant="secondary" className="mb-4 px-3.5 py-1 text-xs gap-1.5 shadow-sm font-bold text-zinc-950">
            <Sparkles className="h-3.5 w-3.5 text-zinc-900" />
            Official Result & Championship Portal
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-3 text-white">
            ZIMRAH <span className="text-zim-gold">2026</span>
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-emerald-100 mb-2 font-malayalam">
            ഗാനാലാപന മഹോത്സവം – Song of Praise
          </p>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
            CSI Madhya Kerala Diocese – Adoor Clergy District Youth Movement Kalolsavam. Real-time verified stage scores, official scorecards, and live championship rankings.
          </p>

          {/* Search Box in Hero */}
          <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto mb-8 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by chest number (e.g. 001), name, church, or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/95 text-slate-900 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-zim-gold shadow-lg"
              />
            </div>
            <Button type="submit" variant="secondary" className="px-6 font-bold text-xs gap-1.5 shadow-lg">
              <Search className="h-4 w-4" /> Search
            </Button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="gap-2 shadow-md font-bold text-sm">
              <Link to="/results">
                <Award className="h-5 w-5" />
                View Published Results
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur font-bold text-sm"
            >
              <Link to="/championship/church">
                <Trophy className="h-5 w-5 text-zim-gold" />
                Church Standings
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur font-bold text-sm"
            >
              <Link to="/championship/individual">
                <Award className="h-5 w-5 text-zim-gold" />
                Individual Contestants
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Event Statistics & Quick Metrics */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-zim-primary flex items-center justify-center shrink-0">
                <Music className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Competitions</p>
                <p className="text-2xl font-black text-slate-900">{summary?.total_events ?? 34}</p>
                <p className="text-[11px] text-emerald-700 font-semibold">4 Distinct Divisions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Published Results</p>
                <p className="text-2xl font-black text-slate-900">{summary?.published_results ?? 0}</p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {summary ? `${summary.pending_results} Awaited (${summary.completion_pct}%)` : 'Live Polling'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Leading Parish</p>
                <p className="text-sm font-black text-slate-900 truncate">
                  {leadingChurch ? leadingChurch.church_name : 'Leaderboard Ready'}
                </p>
                <p className="text-[11px] text-blue-700 font-semibold">
                  {leadingChurch ? `${Number(leadingChurch.total_points).toFixed(2)} pts (Rank 1)` : '5-Level Tie-Breaker Active'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Award className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kalathilakam Leader</p>
                <p className="text-sm font-black text-slate-900 truncate">
                  {leadingIndividual ? leadingIndividual.participant_name : 'Individual Podium'}
                </p>
                <p className="text-[11px] text-purple-700 font-semibold">
                  {leadingIndividual ? `${Number(leadingIndividual.total_points).toFixed(2)} pts (#${leadingIndividual.chest_number})` : 'Junior & Senior Titles'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top 3 Championship Podiums (Church & Individual) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top 3 Church Standings */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Church Championship Leaders</CardTitle>
                  <p className="text-xs text-slate-500">Official top-3 ranking with 5-level tie-breaking</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs gap-1 text-zim-primary font-bold">
                <Link to="/championship/church">
                  Full Standings <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {topChurches.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Standings will appear once results are published.</p>
              ) : (
                topChurches.map((church, idx) => {
                  const medalColors = [
                    'bg-amber-100 text-amber-800 border-amber-300',
                    'bg-slate-200 text-slate-700 border-slate-300',
                    'bg-amber-50 text-amber-900 border-amber-200',
                  ];
                  return (
                    <div
                      key={church.church_id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-8 w-8 rounded-lg border font-black text-xs flex items-center justify-center shrink-0 ${medalColors[idx] || 'bg-slate-100'}`}
                        >
                          #{church.rank}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate">{church.church_name}</p>
                          <p className="text-xs text-slate-500">
                            {church.church_code} • {church.first_places} Firsts • {church.grade_a_count} Grade A
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-sm text-zim-primary">{Number(church.total_points).toFixed(2)} pts</p>
                        {church.is_tied && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700">
                            TIED
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Top 3 Individual Contestants */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Individual Championship Leaders</CardTitle>
                  <p className="text-xs text-slate-500">Kalathilakam & Kalaprathibha contenders</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs gap-1 text-zim-primary font-bold">
                <Link to="/championship/individual">
                  Full Standings <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {topIndividuals.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Contestant rankings will update as results publish.</p>
              ) : (
                topIndividuals.map((p, idx) => {
                  const medalColors = [
                    'bg-amber-100 text-amber-800 border-amber-300',
                    'bg-slate-200 text-slate-700 border-slate-300',
                    'bg-amber-50 text-amber-900 border-amber-200',
                  ];
                  return (
                    <div
                      key={p.participant_id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-8 w-8 rounded-lg border font-black text-xs flex items-center justify-center shrink-0 ${medalColors[idx] || 'bg-slate-100'}`}
                        >
                          #{p.rank}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate">
                            {p.participant_name} <span className="font-mono text-xs text-zim-primary">#{p.chest_number}</span>
                          </p>
                          <p className="text-xs text-slate-500 truncate">{p.church_name}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-sm text-purple-700">{Number(p.total_points).toFixed(2)} pts</p>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-200 text-purple-600">
                          {p.category}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Latest Published Results Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-row items-center justify-between mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">Latest Published Results</h2>
            <p className="text-xs text-slate-500">Official stage results verified by diocesan judges</p>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs gap-1 font-bold">
            <Link to="/results">
              View All 34 Results <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {latestPublished.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-slate-400">
            <p className="text-sm font-semibold">Results will be announced as competitions conclude.</p>
            <p className="text-xs mt-1">Live updates refresh automatically every 25 seconds.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {latestPublished.map((res) => {
              const winner = res.entries?.find((e) => e.position === 1);
              return (
                <Link key={res.id} to={`/results/${res.event?.code || res.event_id}`} className="group">
                  <Card className="hover:shadow-md hover:border-emerald-300 transition-all h-full">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="font-mono text-xs font-bold text-zim-primary border-emerald-300">
                            {res.event?.code || 'EVENT'}
                          </Badge>
                          <Badge variant="success" className="text-[10px]">
                            PUBLISHED
                          </Badge>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-zim-primary transition-colors">
                          {res.event?.name || 'Competition Scorecard'}
                        </h3>
                        {winner && (
                          <div className="mt-3 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                              <Trophy className="h-3 w-3 text-zim-gold" /> 1st Prize Winner
                            </p>
                            <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                              {winner.participant_name} <span className="font-mono text-[11px] text-emerald-700">#{winner.chest_number}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{winner.church?.name}</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-zim-primary font-bold">
                        <span>View Scorecard</span>
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Venues & Divisions Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Competition Schedule & Venues
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Official diocesan schedule across Literary and Stage categories
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-t-4 border-t-zim-gold hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="secondary" className="gap-1">
                  <Calendar className="h-3 w-3" /> 8 November 2026
                </Badge>
                <span className="text-xs font-bold text-slate-400">10 Competitions</span>
              </div>
              <CardTitle className="text-xl">Literary Events (സാഹിത്യ മത്സരങ്ങൾ)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p className="flex items-center gap-1.5 font-medium text-slate-800">
                <MapPin className="h-4 w-4 text-zim-gold shrink-0" />
                <span>Venue: Thazhathmon, TVM</span>
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Includes Essay Writing, Poetry Writing, Short Story Writing, and Elocution across Junior and Senior categories.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full gap-2 mt-2 font-bold text-xs">
                <Link to="/events?category=literary">
                  Explore Literary Events <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-zim-primary hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="default" className="gap-1">
                  <Calendar className="h-3 w-3" /> 14 November 2026
                </Badge>
                <span className="text-xs font-bold text-slate-400">24 Competitions</span>
              </div>
              <CardTitle className="text-xl">Stage Events (സ്റ്റേജ് മത്സരങ്ങൾ)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p className="flex items-center gap-1.5 font-medium text-slate-800">
                <MapPin className="h-4 w-4 text-zim-primary shrink-0" />
                <span>Venue: St. Mathias CSI Church, Munroethuruth</span>
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Featuring Solo Eastern, Western, Light Music, Classical, Organ Recital, Instrumental, Group Song, Choir, and Tableau.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full gap-2 mt-2 font-bold text-xs">
                <Link to="/events?category=stage">
                  Explore Stage Events <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
