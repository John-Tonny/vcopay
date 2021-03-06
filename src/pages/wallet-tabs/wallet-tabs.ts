import { Component, ViewChild } from '@angular/core';
import { Events, NavParams, Platform } from 'ionic-angular';
import { Subscription } from 'rxjs';

// Pages
import { ColdStakingPage } from '../cold-staking/cold-staking';
import { ReceivePage } from '../receive/receive';
import { SendPage } from '../send/send';
import { WalletDetailsPage } from '../wallet-details/wallet-details';

// Providers
import { PlatformProvider } from '../../providers/platform/platform';
import { ProfileProvider } from '../../providers/profile/profile';
import { WalletTabsProvider } from './wallet-tabs.provider';

import * as _ from 'lodash';

@Component({
  template: `
    <ion-tabs selectedIndex="1" #tabs>
      <ion-tab
        [root]="receiveRoot"
        tabTitle="{{'Receive'|translate}}"
        tabIcon="tab-receive"
      ></ion-tab>
      <ion-tab
        [root]="activityRoot"
        tabTitle="{{'Activity'|translate}}"
        tabIcon="tab-activity"
      ></ion-tab>
      <ion-tab
        [root]="sendRoot"
        tabTitle="{{'Send'|translate}}"
        tabIcon="tab-send"
      ></ion-tab>
      <!--ion-tab
        *ngIf="canColdStake"
        [root]="stakingRoot"
        tabTitle="{{'Staking'|translate}}"
        tabIcon="snow"
      ></ion-tab-->
    </ion-tabs>
  `
})
export class WalletTabsPage {
  @ViewChild('tabs')
  walletTabs: any;

  receiveRoot = ReceivePage;
  activityRoot = WalletDetailsPage;
  sendRoot = SendPage;
  stakingRoot = ColdStakingPage;

  walletId: string;
  canColdStake: boolean = false;

  private isElectron: boolean;
  private onPauseSubscription: Subscription;
  private onResumeSubscription: Subscription;

  constructor(
    private navParams: NavParams,
    private walletTabsProvider: WalletTabsProvider,
    private events: Events,
    private platformProvider: PlatformProvider,
    private platform: Platform,
    public profileProvider: ProfileProvider
  ) {
    this.isElectron = this.platformProvider.isElectron;
  }

  ionViewDidLoad() {
    this.walletId = this.navParams.get('walletId');

    this.onPauseSubscription = this.platform.pause.subscribe(() => {
      this.unsubscribeEvents();
    });
    this.onResumeSubscription = this.platform.resume.subscribe(() => {
      this.subscribeEvents();
    });

    this.events.subscribe('Local/TxAction', walletId => {
      if (this.walletId == walletId) this.events.publish('Wallet/updateAll');
    });

    this.checkColdStake();
  }

  ionViewWillEnter() {
    if (this.isElectron) {
      this.updateDesktopOnFocus();
    }
    this.subscribeEvents();
  }

  private subscribeEvents(): void {
    this.events.subscribe('bwsEvent', (walletId, type) => {
      // Update current address
      if (this.walletId == walletId && type == 'NewIncomingTx')
        this.events.publish('Wallet/setAddress', true);
      // Update wallet details
      if (this.walletId == walletId && type != 'NewAddress')
        this.events.publish('Wallet/updateAll');
    });
  }

  ionViewWillLeave() {
    this.unsubscribeEvents();
  }

  private unsubscribeEvents(): void {
    this.events.publish('Wallet/disableHardwareKeyboard');
    this.events.unsubscribe('bwsEvent');
    this.events.unsubscribe('Wallet/setAddress');
    this.events.unsubscribe('Wallet/disableHardwareKeyboard');
  }

  private updateDesktopOnFocus() {
    const { remote } = (window as any).require('electron');
    const win = remote.getCurrentWindow();
    win.on('focus', () => {
      this.events.publish('Wallet/updateAll');
      this.events.publish('Wallet/setAddress', false);
    });
  }

  ngAfterViewInit() {
    this.walletTabsProvider.setTabNav(this.walletTabs);
  }

  ngOnDestroy() {
    this.walletTabsProvider.clear();
    this.onPauseSubscription.unsubscribe();
    this.onResumeSubscription.unsubscribe();
    this.events.unsubscribe('Local/TxAction');
    this.events.unsubscribe('Wallet/updateAll');
    this.events.publish('Home/reloadStatus');
  }

  private checkColdStake() {
    const wallet = this.profileProvider.getWallet(this.walletId);
    const isSingleAddress =
      wallet.status &&
      wallet.status.wallet &&
      wallet.status.wallet.singleAddress;
    if (isSingleAddress !== undefined) {
      this.canColdStake = 
        wallet.coin === 'part' && 
        ((wallet.n === 1 && !isSingleAddress) ||
         (wallet.n > 1));
    } else {
      this.canColdStake = false;

      _.delay(() => {
        this.checkColdStake();
      }, 250);
    }
  }
}
