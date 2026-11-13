import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  ArrowLeft,
  Share2,
  Check,
  Trophy,
  CheckCircle2,
  Printer,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { resultService } from '@/services/resultService';
import { eventService } from '@/services/eventService';

export const ResultDetailPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [copied, setCopied] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Fetch event by code
  const { data: event, isLoading: isLoadingEvent } = useQuery({
    queryKey: ['public-event-detail', code],
    queryFn: async () => {
      const res = await eventService.getEvents({ search: code, pageSize: 5 });
      return res.events.find((e) => e.code.toUpperCase() === code.toUpperCase()) || null;
    },
    enabled: !!code,
  });

  // Fetch result scorecard
  const { data: eventDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['public-result-scorecard', event?.id],
    queryFn: () => (event ? resultService.getEventResultDetail(event.id) : null),
    enabled: !!event?.id,
    refetchInterval: 25000,
  });

  const isPublished = eventDetail?.result?.status === 'PUBLISHED';
  const entries = eventDetail?.entries || [];

  const shareUrl = window.location.href;
  const winner1 = entries.find((e) => e.position === 1);
  const shareText = `*ZIMRAH 2026 – Official Result Scorecard*\n🏆 Competition: ${event?.code} - ${event?.name}\n${winner1 ? `🥇 1st Prize: ${winner1.participant_name} (#${winner1.chest_number}) - ${winner1.church?.name} (${Number(winner1.total_points).toFixed(2)} pts)\n` : ''}View full verified scorecard: ${shareUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoadingEvent || isLoadingDetail) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex justify-center">
        <LoadingSpinner size="lg" text="Loading official competition scorecard..." />
      </div>
    );
  }

  const top1 = entries.find((e) => e.position === 1);
  const top2 = entries.find((e) => e.position === 2);
  const top3 = entries.find((e) => e.position === 3);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button and Print/Share toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/results"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-zim-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Results Directory
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShareDialogOpen(true)} className="gap-1.5 text-xs font-bold">
            <Share2 className="h-3.5 w-3.5" /> Share Scorecard
          </Button>
        </div>
      </div>

      {/* Official Print Diocesan Header (visible in print) */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
        <h2 className="text-xl font-black uppercase tracking-tight">CSI Madhya Kerala Diocese</h2>
        <p className="text-sm font-bold text-slate-700">Adoor Clergy District Youth Movement – ZIMRAH 2026</p>
        <p className="text-xs text-slate-500 font-malayalam mt-0.5">ഗാനാലാപന മഹോത്സവം – Official Result Scorecard</p>
      </div>

      {/* Event Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="font-mono font-bold text-zim-primary text-xs">
                {event?.code || code}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {event?.category?.name || 'Stage Competition'}
              </Badge>
              {isPublished && (
                <Badge variant="success" className="text-xs gap-1 font-bold">
                  <CheckCircle2 className="h-3 w-3" /> Official Result Published
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              {event?.name || 'Competition Scorecard'}
            </h1>
            {event?.name_malayalam && (
              <p className="text-sm font-medium text-slate-500 font-malayalam mt-1">
                {event.name_malayalam} • Division: {event.division?.name || 'General Division'}
              </p>
            )}
          </div>

          <div className="text-left sm:text-right text-xs text-slate-400">
            {eventDetail?.result?.published_at ? (
              <p>
                Published: <span className="font-medium text-slate-700">{new Date(eventDetail.result.published_at).toLocaleString()}</span>
              </p>
            ) : (
              <p className="font-semibold text-amber-600">Verification in progress</p>
            )}
          </div>
        </div>
      </div>

      {/* Published Scorecard vs Results Awaited */}
      {isPublished && entries.length > 0 ? (
        <div className="space-y-6">
          {/* Top 3 Podium Winners Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
            {/* 2nd Place */}
            {top2 && (
              <Card className="border-slate-300 bg-slate-50/50 order-2 md:order-1 shadow-2xs">
                <CardContent className="p-6 text-center">
                  <Badge variant="secondary" className="mb-2 font-bold">2nd Place (Silver)</Badge>
                  <div className="h-12 w-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center mx-auto mb-2 font-black text-lg">
                    2
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">{top2.participant_name}</h4>
                  <p className="text-xs text-slate-500 mb-2">{top2.church?.name} (#{top2.chest_number})</p>
                  <p className="text-sm font-extrabold text-zim-primary">
                    {Number(top2.total_points).toFixed(2)} pts {top2.grade && `(Grade ${top2.grade})`}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 1st Place */}
            {top1 && (
              <Card className="border-amber-400 bg-amber-50/40 order-1 md:order-2 shadow-sm scale-100 md:scale-105 transition-transform">
                <CardContent className="p-6 text-center">
                  <Badge className="bg-amber-500 text-white font-bold mb-2">1st Place (Gold)</Badge>
                  <div className="h-14 w-14 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center mx-auto mb-2 font-black text-xl shadow-xs">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <h4 className="font-black text-slate-900 text-lg">{top1.participant_name}</h4>
                  <p className="text-xs text-slate-600 mb-2">{top1.church?.name} (#{top1.chest_number})</p>
                  <p className="text-base font-black text-zim-primary">
                    {Number(top1.total_points).toFixed(2)} pts {top1.grade && `(Grade ${top1.grade})`}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 3rd Place */}
            {top3 && (
              <Card className="border-amber-600/30 bg-amber-50/20 order-3 shadow-2xs">
                <CardContent className="p-6 text-center">
                  <Badge className="bg-amber-700 text-white font-bold mb-2">3rd Place (Bronze)</Badge>
                  <div className="h-12 w-12 rounded-full bg-amber-700 text-white flex items-center justify-center mx-auto mb-2 font-black text-lg">
                    3
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">{top3.participant_name}</h4>
                  <p className="text-xs text-slate-500 mb-2">{top3.church?.name} (#{top3.chest_number})</p>
                  <p className="text-sm font-extrabold text-zim-primary">
                    {Number(top3.total_points).toFixed(2)} pts {top3.grade && `(Grade ${top3.grade})`}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Full Official Table */}
          <Card>
            <CardHeader className="border-b border-slate-100 py-4">
              <CardTitle className="text-base font-bold text-slate-900">
                Official Result Scorecard (Authoritative Server Recalculation)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-xs">
                      <TableHead className="w-20 text-center font-bold">Position</TableHead>
                      <TableHead className="w-24 font-bold">Chest #</TableHead>
                      <TableHead className="font-bold">Contestant / Team Name</TableHead>
                      <TableHead className="font-bold">Church / Parish</TableHead>
                      <TableHead className="w-20 text-center font-bold">Grade</TableHead>
                      <TableHead className="w-24 text-center font-bold">Grade Pts</TableHead>
                      <TableHead className="w-24 text-center font-bold">Pos Pts</TableHead>
                      <TableHead className="w-28 text-right font-bold pr-6">Total Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((ent) => (
                      <TableRow key={ent.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-center">
                          {ent.position === 1 && (
                            <Badge className="bg-amber-500 text-white font-bold text-xs">1st</Badge>
                          )}
                          {ent.position === 2 && (
                            <Badge className="bg-slate-400 text-white font-bold text-xs">2nd</Badge>
                          )}
                          {ent.position === 3 && (
                            <Badge className="bg-amber-700 text-white font-bold text-xs">3rd</Badge>
                          )}
                          {!ent.position && <span className="text-slate-400 font-mono text-xs">-</span>}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-xs">{ent.chest_number}</TableCell>
                        <TableCell className="font-bold text-slate-900 text-sm">{ent.participant_name}</TableCell>
                        <TableCell className="text-xs text-slate-600">{ent.church?.name || ent.church_id}</TableCell>
                        <TableCell className="text-center font-bold text-xs">
                          {ent.grade ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                              {ent.grade}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {Number(ent.grade_points).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {Number(ent.position_points).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-sm text-zim-primary pr-6">
                          {Number(ent.total_points).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Results Awaited State */
        <Card className="border-dashed border-2 border-amber-300/80 bg-amber-50/30">
          <CardContent className="p-12 text-center max-w-md mx-auto">
            <div className="h-16 w-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Clock className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">
              Results Awaited
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Judges and the Result Verification Committee are currently compiling and verifying the official marks for this competition.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-amber-200 text-xs font-semibold text-amber-800 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span>Live 25s auto-polling active</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Share Scorecard Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Share2 className="h-5 w-5 text-zim-primary" />
              Share Official Scorecard
            </DialogTitle>
            <DialogDescription>
              Share verified ZIMRAH 2026 competition marks across social networks
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line font-medium leading-relaxed">
              {shareText}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleWhatsAppShare}
                className="gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-xs"
              >
                Share on WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleFacebookShare}
                className="gap-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200 font-bold text-xs"
              >
                Share on Facebook
              </Button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-slate-100 px-3 py-2 rounded-lg text-xs font-mono text-slate-600 select-all focus:outline-none"
              />
              <Button size="sm" variant="default" onClick={handleCopyLink} className="gap-1 font-bold text-xs shrink-0">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
