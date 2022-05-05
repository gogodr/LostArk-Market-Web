import { Component, OnDestroy, OnInit, ViewChild, ɵɵsetComponentScope } from '@angular/core';
import { FormControl } from '@angular/forms';
import { filter, map, Observable, shareReplay, startWith, Subscription, take } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ItemsTableComponent } from './items-table/items-table.component';
import { Analytics, logEvent } from '@angular/fire/analytics';
import slugify from 'slugify';

import type { Filter } from './market.interfaces';
import type { FavoriteItem } from './items-table/items-table.interfaces';

import autocompleteOptions from '../../../data/autocomplete.json';
import { regionMap } from '../../../app/navigation/navigation.component';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

const categoriesMap: { [slug: string]: { category: string, subcategories?: { [subslug: string]: string } } } = {
  'enhancement-materials': {
    category: 'Enhancement Material',
    subcategories: {
      'honing-materials': 'Honing Materials',
      'additional-honing-materials': 'Additional Honing Materials',
      'other-materials': 'Other Materials',
    }
  },
  'trader': {
    category: 'Trader',
    subcategories: {
      'foraging-rewards': 'Foraging Rewards',
      'loggin-loot': 'Logging Loot',
      'mining-loot': 'Mining Loot',
      'hunting-loot': 'Hunting Loot',
      'fishing-loot': 'Fishing Loot',
      'excavating-loot': 'Excavating Loot',
      'other': 'Other',
    }
  },
  'engraving-recipe': {
    category: 'Engraving Recipe'
  },
  'combat-supplies': {
    category: 'Combat Supplies',
    subcategories: {
      'recovery': 'Battle Item - Recovery',
      'offense': 'Battle Item - Offense',
      'utility': 'Battle Item - Utility',
      'buff': 'Battle Item - Buff',
    }
  },
  'adventurers-tome': {
    category: 'Adventurer\'s Tome'
  }
}

@Component({
  selector: 'app-market',
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.css']
})
export class MarketComponent implements OnInit, OnDestroy {
  searchControl = new FormControl();
  options: string[] = autocompleteOptions;
  filteredOptions?: Observable<string[]>;
  favorites: FavoriteItem[];
  filter: Filter;
  regionSlug: string = "";
  routeSubscription: Subscription;

  isHandset$: Observable<boolean> = this.breakpointObserver.observe([Breakpoints.Large, Breakpoints.XLarge])
    .pipe(
      map(result => !result.matches),
      shareReplay()
    );

  menu = {
    enhancementMaterialsSubMenu: false,
    traderSubMenu: false,
    combatSubMenu: false,
    engravingSubMenu: false,
    adventurersTomeSubMenu: false,
  }

  @ViewChild(ItemsTableComponent) marketTable!: ItemsTableComponent;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private analytics: Analytics,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.favorites = JSON.parse(localStorage.getItem('favorites') || 'null') || [];
    this.filter = {
      region: localStorage.getItem('region') || 'North America East',
      favorites: true
    };
    this.filteredOptions = this.searchControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value)),
    );
    this.routeSubscription = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => route),
      map(route => {
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route;
      })).subscribe(route => {
        const { search } = route.snapshot.queryParams;
        if (search) {
          this.searchControl.setValue(search);
          this.filter.category = undefined;
          this.filter.subcategory = undefined;
          this.filter.favorites = false;
          this.filter.search = search;
          return;
        }
        const { region, category, subcategory } = route.snapshot.params;
        if (category) {
          if (category == 'favorites') {
            this.filter.favorites = true;
            this.filter.category = undefined;
            this.filter.subcategory = undefined;
          } else {
            this.filter.favorites = false;
            this.filter.category = categoriesMap[category].category;
            if (subcategory) {
              this.filter.subcategory = categoriesMap[category].subcategories![subcategory];
            } else {
              this.filter.subcategory = undefined;
            }
          }
        } else {
          this.filter.favorites = true;
          this.filter.category = undefined;
          this.filter.subcategory = undefined;
        }
        switch (this.filter.category) {
          case 'Enhancement Material':
            this.menu.enhancementMaterialsSubMenu = true;
            break;
          case 'Trader':
            this.menu.traderSubMenu = true;
            break;
          case 'Engraving Recipe':
            this.menu.engravingSubMenu = true;
            break;
          case 'Combat Supplies':
            this.menu.combatSubMenu = true;
            break;
          case 'Adventurer\'s Tome':
            this.menu.adventurersTomeSubMenu = true;
            break;
        }
        if (regionMap[region]) {
          this.filter.region = regionMap[region];
        }
        this.regionSlug = slugify(this.filter.region, { lower: true });
        if (this.marketTable?.dataSource) {
          this.marketTable.dataSource.refreshMarket();
        }
      });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  ngOnInit(): void {
  }

  search() {
    const search = this.searchControl.value;
    if (search) {
      logEvent(this.analytics, 'search', { query: search });
      window.history.pushState(null, this.filter.region, slugify(this.filter.region).toLowerCase() + `?search=${encodeURIComponent(search)}`);
    } else {
      window.history.pushState(null, this.filter.region, slugify(this.filter.region).toLowerCase());
    }
    this.filter.category = undefined;
    this.filter.subcategory = undefined;
    this.filter.favorites = false;
    this.filter.search = search;
    this.menu = {
      enhancementMaterialsSubMenu: false,
      traderSubMenu: false,
      combatSubMenu: false,
      engravingSubMenu: false,
      adventurersTomeSubMenu: false,
    }
    this.marketTable.dataSource.refreshMarket();
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    if (!value || value.length < 3) {
      return [];
    }
    return this.options.filter(option => option.toLowerCase().includes(filterValue));
  }

}