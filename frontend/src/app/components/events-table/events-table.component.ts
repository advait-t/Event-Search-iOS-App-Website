import { Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, Observable, of, Subscription } from 'rxjs';
import { matchesFavorite, readFavorites } from '../../service/favorites';

@Component({
  selector: 'app-events-table',
  templateUrl: './events-table.component.html',
  styleUrls: ['./events-table.component.css']
})
export class EventsTableComponent implements OnDestroy {
  @Input() events: any[] = [];

  eventDetails: any;
  artists: any[] = [];
  venue: any;
  loading = false;
  error = '';

  private request = new Subscription();
  private activeEventId = '';

  @ViewChild('detailRegion') set detailRegion(region: ElementRef<HTMLElement> | undefined) {
    if (region) requestAnimationFrame(() => {
      if (region.nativeElement.isConnected) region.nativeElement.focus();
    });
  }

  @ViewChild('resultRegion') set resultRegion(region: ElementRef<HTMLElement> | undefined) {
    if (!region || !this.activeEventId) return;
    const eventId = this.activeEventId;
    this.activeEventId = '';
    requestAnimationFrame(() => {
      const trigger = Array.from(region.nativeElement.querySelectorAll<HTMLButtonElement>('[data-event-id]'))
        .find(button => button.dataset['eventId'] === eventId);
      trigger?.focus();
    });
  }

  constructor(private http: HttpClient) {}

  clickEventName(eventId: string): void {
    this.closeDetails();
    this.loading = true;

    this.request.add(this.http.get<any>('/event_details', { params: { event_id: eventId } }).subscribe({
      next: details => {
        this.activeEventId = eventId;
        this.eventDetails = details;
        details.isFav = readFavorites().some(saved => matchesFavorite(saved, {
          event_id: details.event_id,
          name: details.name1,
          date: details.date,
          venue: details.venue,
          time: details.time
        }));
        this.loading = false;
        this.loadSupplementalDetails(details);
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load event details. Select an event to try again.';
      }
    }));
  }

  private loadSupplementalDetails(details: any): void {
    if (details.venue) {
      this.request.add(this.http.get('/venue_details', { params: { venue_name: details.venue } }).subscribe({
        next: venue => this.venue = venue,
        error: () => this.venue = undefined
      }));
    }

    if (details.music_related === 'Music' && details.artist_list.length) {
      const requests: Observable<unknown>[] = details.artist_list.map((name: string) =>
        this.http.get('/spotify_artist_info', { params: { artist_name: name } }).pipe(catchError(() => of(null)))
      );
      this.request.add(forkJoin(requests).subscribe(artists => {
        this.artists = artists.filter(Boolean);
      }));
    }
  }

  closeDetails(): void {
    this.request.unsubscribe();
    this.request = new Subscription();
    this.eventDetails = undefined;
    this.venue = undefined;
    this.artists = [];
    this.loading = false;
    this.error = '';
  }

  ngOnDestroy(): void {
    this.request.unsubscribe();
  }
}
