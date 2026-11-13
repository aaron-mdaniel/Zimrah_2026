import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Music, Clock, ArrowRight, Users, User, Info, Trophy, Filter } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchInput } from '@/components/forms/SearchInput';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { eventService } from '@/services/eventService';
import type { CompetitionEvent } from '@/types';

export const EventsPage: React.FC = () => {
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<CompetitionEvent | null>(null);

  // Fetch all events from backend service
  const { data: eventsRes, isLoading } = useQuery({
    queryKey: ['public-events-catalog'],
    queryFn: () => eventService.getEvents({ pageSize: 100 }),
  });

  const events = eventsRes?.events || [];

  const divisions = [
    { id: 'all', label: 'All (34 Events)' },
    { id: 'div_1', label: 'Div 1: Music (16)' },
    { id: 'div_2', label: 'Div 2: Fine Arts (3)' },
    { id: 'div_3', label: 'Div 3: Theater (5)' },
    { id: 'div_4', label: 'Div 4: Writing & Elocution (10)' },
  ];

  const filteredEvents = events.filter((ev) => {
    // Match division
    const matchesDiv =
      selectedDivision === 'all' ||
      ev.division_id === selectedDivision ||
      (ev.division?.division_number && String(ev.division.division_number) === selectedDivision.replace('div_', ''));

    // Match type
    const matchesType = selectedType === 'all' || ev.event_type === selectedType;

    // Match search
    const s = searchQuery.toLowerCase();
    const matchesSearch =
      ev.code.toLowerCase().includes(s) ||
      ev.name.toLowerCase().includes(s) ||
      (ev.name_malayalam && ev.name_malayalam.toLowerCase().includes(s));

    return matchesDiv && matchesType && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        title="Competition Directory"
        subtitle="Browse all 34 official diocesan competitions across 4 divisions and categories"
      />

      {/* Filter and Search Controls */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
          <Tabs value={selectedDivision} onValueChange={setSelectedDivision} defaultValue="all">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
              {divisions.map((div) => (
                <TabsTrigger key={div.id} value={div.id} className="text-xs">
                  {div.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="w-full md:w-72">
            <SearchInput
              placeholder="Search code, English or Malayalam name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
            />
          </div>
        </div>

        {/* Sub-filter: Event Type */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-semibold text-slate-700">Event Type:</span>
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${selectedType === 'all' ? 'bg-zim-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('INDIVIDUAL')}
            className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${selectedType === 'INDIVIDUAL' ? 'bg-zim-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Individual (Solo)
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('GROUP')}
            className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${selectedType === 'GROUP' ? 'bg-zim-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Group Teams
          </button>
        </div>
      </div>

      {/* Competitions Grid */}
      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" text="Loading official competition events..." />
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No competitions match your search"
          description={searchQuery ? `No events matching "${searchQuery}"` : 'No events found in this division.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev) => (
            <Card
              key={ev.id || ev.code}
              className="hover:shadow-md transition-shadow border-slate-200 flex flex-col justify-between"
            >
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="font-mono font-bold text-zim-primary border-emerald-300 bg-emerald-50/50">
                      {ev.code}
                    </Badge>
                    <Badge variant={ev.event_type === 'GROUP' ? 'secondary' : 'default'} className="text-[10px]">
                      {ev.event_type === 'GROUP' ? 'GROUP TEAM' : 'INDIVIDUAL'}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base leading-snug mb-1">
                    {ev.name}
                  </h3>
                  {ev.name_malayalam && (
                    <p className="text-sm font-medium text-slate-500 mb-4 font-malayalam">
                      {ev.name_malayalam}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{ev.duration_display || `${ev.duration_minutes || 5} min`}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ev.event_type === 'GROUP' ? (
                        <>
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span>{ev.min_participants}-{ev.max_participants} Members</span>
                        </>
                      ) : (
                        <>
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>Solo Contestant</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedEvent(ev)}
                      className="flex-1 text-xs gap-1 h-8"
                    >
                      <Info className="h-3.5 w-3.5" /> Details
                    </Button>
                    <Button asChild size="sm" variant="secondary" className="flex-1 text-xs gap-1 h-8 font-bold">
                      <Link to={`/results/${ev.code}`}>
                        Scorecard <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono font-bold text-zim-primary">
                {selectedEvent?.code}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {selectedEvent?.event_type}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-black text-slate-900">
              {selectedEvent?.name}
            </DialogTitle>
            {selectedEvent?.name_malayalam && (
              <DialogDescription className="font-malayalam text-sm text-slate-600 font-medium">
                {selectedEvent.name_malayalam}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium">Category: </span>
                  <span className="font-bold text-slate-900">{selectedEvent.category?.name || 'Stage Event'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Division: </span>
                  <span className="font-bold text-slate-900">{selectedEvent.division?.name || 'General Division'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Duration: </span>
                  <span className="font-bold text-slate-900">{selectedEvent.duration_display || `${selectedEvent.duration_minutes || 5} min`}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Entries per Parish: </span>
                  <span className="font-bold text-slate-900">Max {selectedEvent.max_entries_per_church || 1} Team</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Team Roster: </span>
                  <span className="font-bold text-slate-900">
                    {selectedEvent.min_participants === selectedEvent.max_participants
                      ? `${selectedEvent.min_participants} participant`
                      : `${selectedEvent.min_participants} to ${selectedEvent.max_participants} members`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Status: </span>
                  <span className="font-bold text-emerald-700">Active Competition</span>
                </div>
              </div>

              <div className="space-y-1.5 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
                <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-zim-gold" /> Championship Attribution (ADR-004 & ADR-006)
                </p>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Points earned contribute to the Church Championship (single parish credit). For group events, registered team members receive individual championship points allocated without score inflation.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
                <Button asChild size="sm" variant="default" className="gap-1 font-bold">
                  <Link to={`/results/${selectedEvent.code}`}>
                    View Official Scorecard <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
