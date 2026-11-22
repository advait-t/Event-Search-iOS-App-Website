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
  locating = false;
  locationError = '';
  status: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  error = '';

  private search?: Subscription;
  private autocomplete?: Subscription;
  private cityRequest?: Subscription;
  private detection = new Subscription();
  private detectedCoordinates = '';
  private manualLocation = '';
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

  autoDetect(enabled: boolean): void {
    this.detection.unsubscribe();
    this.detection = new Subscription();
    this.auto_detect = enabled;
    this.detectedCoordinates = '';
    this.locationError = '';
    this.locationSuggestions = [];
    this.locating = enabled;

    if (!enabled) {
      this.location = this.manualLocation;
      return;
    }

    this.manualLocation = this.location;
    this.location = '';

    const position = new Observable<GeolocationCoordinates>(subscriber => {
      const fail = () => subscriber.error(new Error('Location unavailable'));
      if (!navigator.geolocation) {
        fail();
        return;
      }
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        subscriber.next(coords);
        subscriber.complete();
      }, fail, { timeout: 10000 });
    });

    this.detection.add(position.subscribe({
      next: ({ latitude, longitude }) => {
        this.detectedCoordinates = `${latitude},${longitude}`;
        this.location = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
        this.locating = false;
        const location = this.location;
        this.detection.add(this.http.get<{ label: string }>('/location_label', { params: { location } }).subscribe({
          next: ({ label }) => { if (label) this.location = label; },
          error: () => {} // Coordinates are already displayed and can be used for search.
        }));
      },
      error: () => {
        this.autoDetect(false);
        this.locationError = 'Could not detect your location. Enter a city or ZIP code.';
      }
    }));
  }

  onSubmit(): void {
    if (this.locating) return;

    this.search?.unsubscribe();
    this.autocomplete?.unsubscribe();
    this.suggestions = [];
    this.events = [];
    this.status = 'loading';
    this.error = '';

    const params = {
      keyword: this.keyword.trim(),
      distance: this.distance ?? 10,
      category: this.category,
      location: this.auto_detect ? this.detectedCoordinates : this.location.trim()
    };

    this.search = this.http.get<any[]>('/events', { params }).subscribe({
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
    this.autoDetect(false);
    this.manualLocation = '';
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
    this.detection.unsubscribe();
    this.cityRequest?.unsubscribe();
    this.search?.unsubscribe();
    this.autocomplete?.unsubscribe();
  }
}
