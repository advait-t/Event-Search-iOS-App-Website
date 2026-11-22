import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Favorite, matchesFavorite, readFavorites, writeFavorites } from '../../service/favorites';

@Component({
  selector: 'app-details-card',
  templateUrl: './details-card.component.html',
  styleUrls: ['./details-card.component.css']
})
export class DetailsCardComponent {
  @Input() event_details: any;
  @Input() artist_info: any;
  @Input() venue_info: any;
  @Output() closed = new EventEmitter<void>();
  favoriteError = '';
  showMore1: boolean = false;
  showMore2: boolean = false;
  showMore3: boolean = false;
  
  get venueMapUrl(): string | undefined {
    const venue = this.venue_info;
    const name = venue?.venue_name || this.event_details?.venue;
    const address = [venue?.address, venue?.city, venue?.state, venue?.postal_code]
      .filter(Boolean).join(', ');
    const coordinates = Number.isFinite(venue?.latitude) && Number.isFinite(venue?.longitude)
      ? `${venue.latitude},${venue.longitude}`
      : undefined;
    const query = address ? [name, address].filter(Boolean).join(', ') : coordinates ?? name;
    if (!query) return undefined;

    return 'https://www.google.com/maps/search/?' + new URLSearchParams({ api: '1', query });
  }

  spotifySearchUrl(artist: string): string {
    return 'https://open.spotify.com/search/' + encodeURIComponent(artist);
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

  goBack(): void {
    this.closed.emit();
  }
}
