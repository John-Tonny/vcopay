import { Component, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  AlertController,
  LoadingController,
  Navbar,
  NavController,
  Slides
} from 'ionic-angular';
import { Logger } from '../../../providers/logger/logger';

// pages
import { BackupRequestPage } from '../backup-request/backup-request';

import {BwsName, BwsUrl, PersistenceProvider} from "../../../providers/persistence/persistence";
// import { CollectEmailPage } from '../collect-email/collect-email';

// providers
import { OnGoingProcessProvider } from '../../../providers/on-going-process/on-going-process';
import { PopupProvider } from '../../../providers/popup/popup';
import { ProfileProvider } from '../../../providers/profile/profile';
import { RateProvider } from '../../../providers/rate/rate';
import { TxFormatProvider } from '../../../providers/tx-format/tx-format';

@Component({
  selector: 'page-tour',
  templateUrl: 'tour.html'
})
export class TourPage {
  @ViewChild(Slides)
  slides: Slides;
  @ViewChild(Navbar)
  navBar: Navbar;

  public localCurrencySymbol: string;
  public localCurrencyPerPart: string;
  public currentIndex: number;

  private retryCount: number = 0;

  constructor(
    public alertCtrl: AlertController,
    public navCtrl: NavController,
    public loadingCtrl: LoadingController,
    private logger: Logger,
    private translate: TranslateService,
    private profileProvider: ProfileProvider,
    private rateProvider: RateProvider,
    private txFormatProvider: TxFormatProvider,
    private onGoingProcessProvider: OnGoingProcessProvider,
    private persistenceProvider: PersistenceProvider,
    private popupProvider: PopupProvider
  ) {
    this.currentIndex = 0;
    this.rateProvider.whenRatesAvailable('btc').then(() => {
      let partAmount = 1;
      this.localCurrencySymbol = '$';
      this.localCurrencyPerPart = this.txFormatProvider.formatAlternativeStr(
        'part',
        partAmount * 1e8
      );
    });
  }

  ionViewDidLoad() {
    this.logger.info('Loaded: TourPage');
  }

  ionViewWillEnter() {
    this.navBar.backButtonClick = () => {
      this.slidePrev();
    };
  }

  public slideChanged(): void {
    this.currentIndex = this.slides.getActiveIndex();
  }

  public slidePrev(): void {
    if (this.currentIndex == 0) this.navCtrl.pop();
    else {
      this.slides.slidePrev();
    }
  }

  public slideNext(): void {
    this.slides.slideNext();
  }

  public myAlert(): void {
    var conf = {
      title: '钱包服务提供商',
      inputs: [],
      buttons: [
        {
          text: '取消'
        },
        {
          text: '确定',
          handler: (bwsurl) => {
            this.createDefaultWallet(bwsurl);
          }
        }
      ]
    }

    var nums: number = 0;
    for (var id in BwsUrl) {
      var obj = {
        name: '',
        type: 'radio',
        label: '',
        value: '',
        checked: false
      };
      obj.value = BwsUrl[id];
      obj.name = 'radio' + nums.toString();
      if(nums==0){
        obj.checked = true;
      }
      conf.inputs.push(obj);
      nums ++;
    }
    nums = 0;
    for (var name in BwsName) {
      conf.inputs[nums].label = BwsName[name];
      nums ++;
    }
    const myalert = this.alertCtrl.create(conf);
    myalert.present();
  }

  public selectBwsURL(): void {
    var nums: number = 0;
    for (var _ in BwsUrl) {
      nums ++;
    }
    nums = 0;
    for (var _ in BwsName) {
      nums ++;
    }
    if(nums>1) {
      this.myAlert();
    }else{
      this.createDefaultWallet(BwsUrl[0]);
    }
  }

  public createDefaultWallet(bwsurl): void {
    this.onGoingProcessProvider.set('creatingWallet');
    this.profileProvider
      .createDefaultWallet(bwsurl)
      .then(wallet => {
        this.onGoingProcessProvider.clear();
        this.persistenceProvider.setOnboardingCompleted();
        // this.navCtrl.push(CollectEmailPage, { walletId: wallet.id });
        this.navCtrl.push(BackupRequestPage, { walletId: wallet.id });
      })
      .catch(err => {
        setTimeout(() => {
          this.logger.warn(
            'Retrying to create default wallet.....:' + ++this.retryCount
          );
          if (this.retryCount > 3) {
            this.onGoingProcessProvider.clear();
            let title = this.translate.instant('Cannot create wallet');
            let okText = this.translate.instant('Retry');
            this.popupProvider.ionicAlert(title, err, okText).then(() => {
              this.retryCount = 0;
              this.createDefaultWallet(bwsurl);
            });
          } else {
            this.createDefaultWallet(bwsurl);
          }
        }, 2000);
      });
  }
}
