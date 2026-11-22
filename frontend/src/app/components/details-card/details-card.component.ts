import { Component, EventEmitter, Input, OnDestroy, Output, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
import { Favorite, matchesFavorite, readFavorites, writeFavorites } from '../../service/favorites';

let mapsScript: Promise<void> | undefined;

@Component({
  selector: 'app-details-card',
  templateUrl: './details-card.component.html',
  styleUrls: ['./details-card.component.css']
})
export class DetailsCardComponent implements OnDestroy {
  @Input() event_details: any;
  @Input() artist_info: any;
  @Input() venue_info: any;
  @Output() closed = new EventEmitter<void>();
  mapLoading = false;
  mapError = '';
  favoriteError = '';
  private destroyed = false;
  showMore1: boolean = false;
  showMore2: boolean = false;
  showMore3: boolean = false;
  
  constructor(private http: HttpClient, private modalService: NgbModal) {}

  @ViewChild('google_maps_modal') google_maps_modal!: TemplateRef<any>;

  async openGoogleMapsModal(): Promise<void> {
    this.mapLoading = true;
    this.mapError = '';
    try {
      mapsScript ??= this.loadMaps().catch(error => {
        mapsScript = undefined;
        throw error;
      });
      await mapsScript;
      if (!this.destroyed) this.modalService.open(this.google_maps_modal, { backdrop: false });
    } catch {
      this.mapError = 'The venue map is unavailable.';
    } finally {
      this.mapLoading = false;
    }
  }

  private async loadMaps(): Promise<void> {
    const { key } = await firstValueFrom(this.http.get<{ key: string }>('/maps-config'));
    if (!key) throw new Error('Missing browser Maps configuration');

    const script = document.createElement('script');
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.searchParams.set('key', key);
    script.src = url.toString();

    return new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error('Maps script failed to load'));
      };
      document.head.append(script);
    });
  }

  toggleFavorite(): void {
    const favorite: Favorite = {
      event_id: this.event_details.event_id,
      name: this.event_details.name1,
      genre: this.event_details.genre,
      date: this.event_details.date,
      time: this.event_details.time,
      venue: this.event_details.venue,
      segment: this.event_details.segment,
      subgenre: this.event_details.subgenre,
      type: this.event_details.type,
      subtype: this.event_details.subtype
    };

    this.favoriteError = '';
    try {
      const saved = readFavorites();
      const remaining = saved.filter(item => !matchesFavorite(item, favorite));
      const adding = remaining.length === saved.length;
      writeFavorites(adding ? [...saved, favorite] : remaining);
      this.event_details.isFav = adding;
    } catch {
      this.favoriteError = 'Could not update favorites on this device.';
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  goBack(): void {
    this.closed.emit();
  }
}
