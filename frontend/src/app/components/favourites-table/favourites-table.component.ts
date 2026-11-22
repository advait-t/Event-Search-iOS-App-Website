import { Component } from '@angular/core';
import { Favorite, readFavorites, writeFavorites } from '../../service/favorites';

@Component({
  selector: 'app-favourites-table',
  templateUrl: './favourites-table.component.html',
  styleUrls: ['./favourites-table.component.css']
})
export class FavouritesTableComponent {
  data: Favorite[] = [];
  error = '';

  ngOnInit(): void {
    this.data = readFavorites();
  }

  removeFavourite(event: Favorite): void {
    this.error = '';
    const remaining = this.data.filter(item => item !== event);
    try {
      writeFavorites(remaining);
      this.data = remaining;
    } catch {
      this.error = 'Could not remove the favorite from this device.';
    }
  }
}
