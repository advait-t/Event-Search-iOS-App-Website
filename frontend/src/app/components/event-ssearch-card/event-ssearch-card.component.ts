import { Component, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription, switchMap, timer } from 'rxjs';

@Component({
  selector: 'app-event-ssearch-card',
  templateUrl: './event-ssearch-card.component.html',
  styleUrls: ['./event-ssearch-card.component.css']
})
export class EventSsearchCardComponent implements OnDestroy {
  auto_detect = false;
  events: any[] = [];
  suggestions: string[] = [];
  locationSuggestions: string[] = [];
  keyword = '';
  distance: number | null = null;
  category = 'default';
  location = '';
  status: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  error = '';

  private search?: Subscription;
  private autocomplete?: Subscription;
  private cityRequest?: Subscription;
  private cities?: { label: string; searchable: string }[];

  constructor(private http: HttpClient) {}

  auto_complete(keyword: string): void {
    this.autocomplete?.unsubscribe();
    this.suggestions = [];
    if (!keyword.trim()) return;

    this.autocomplete = timer(250).pipe(
      switchMap(() => this.http.get<string[]>('/autocomplete', { params: { keyword } }))
    ).subscribe({
      next: suggestions => this.suggestions = suggestions,
      error: () => this.suggestions = []
    });
  }

  updateLocation(value: string): void {
    this.location = value;
    this.updateLocationSuggestions();

    if (this.auto_detect || this.normalizeLocation(value).length < 2 || this.cities ||
        (this.cityRequest && !this.cityRequest.closed)) return;

    this.cityRequest = this.http.get<string[]>('assets/location-cities.json').subscribe({
      next: cities => {
        this.cities = cities.map(label => ({ label, searchable: this.normalizeLocation(label) }));
        this.updateLocationSuggestions();
      },
      error: () => this.locationSuggestions = []
    });
  }

  private updateLocationSuggestions(): void {
    const prefix = this.normalizeLocation(this.location);
    this.locationSuggestions = [];
    if (!this.cities || this.auto_detect || prefix.length < 2) return;

    for (const city of this.cities) {
      if (!city.searchable.startsWith(prefix)) continue;
      this.locationSuggestions.push(city.label);
      if (this.locationSuggestions.length === 8) break;
    }
  }

  private normalizeLocation(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      .replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  autoDetect(): void {
    this.location = '';
    this.locationSuggestions = [];
  }

  onSubmit(): void {
    this.search?.unsubscribe();
    this.autocomplete?.unsubscribe();
    this.suggestions = [];
    this.events = [];
    this.status = 'loading';
    this.error = '';

    const params = {
      keyword: this.keyword.trim(),
      distance: this.distance ?? 10,
      category: this.category
    };

    const location = new Observable<string>(subscriber => {
      if (!this.auto_detect) {
        subscriber.next(this.location.trim());
        subscriber.complete();
        return;
      }

      const fail = () => subscriber.error(new Error('Could not detect your location. Enter a city or ZIP code.'));
      if (!navigator.geolocation) {
        fail();
        return;
      }
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        subscriber.next(`${coords.latitude},${coords.longitude}`);
        subscriber.complete();
      }, fail, { timeout: 10000 });
    });

    this.search = location.pipe(
      switchMap(value => this.http.get<any[]>('/events', { params: { ...params, location: value } }))
    ).subscribe({
      next: events => {
        this.events = events;
        this.status = 'success';
      },
      error: error => {
        this.error = error instanceof HttpErrorResponse
          ? error.error?.message || 'Could not search for events. Try again.'
          : error.message;
        this.status = 'error';
      }
    });
  }

  onClear(): void {
    this.search?.unsubscribe();
    this.autocomplete?.unsubscribe();
    this.keyword = '';
    this.distance = null;
    this.category = 'default';
    this.location = '';
    this.locationSuggestions = [];
    this.auto_detect = false;
    this.suggestions = [];
    this.events = [];
    this.status = 'idle';
    this.error = '';
  }

  ngOnDestroy(): void {
    this.cityRequest?.unsubscribe();
    this.search?.unsubscribe();
    this.autocomplete?.unsubscribe();
  }
}
