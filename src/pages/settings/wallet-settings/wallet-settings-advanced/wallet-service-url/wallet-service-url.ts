import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Events, NavController, NavParams } from 'ionic-angular';
import { Logger } from '../../../../../providers/logger/logger';

// native
import { SplashScreen } from '@ionic-native/splash-screen';

// providers
import { AppProvider } from '../../../../../providers/app/app';
import { ConfigProvider } from '../../../../../providers/config/config';
import {BwsName, BwsUrl, PersistenceProvider} from '../../../../../providers/persistence/persistence';
import { PlatformProvider } from '../../../../../providers/platform/platform';
import { ProfileProvider } from '../../../../../providers/profile/profile';
import { ReplaceParametersProvider } from '../../../../../providers/replace-parameters/replace-parameters';

@Component({
  selector: 'page-wallet-service-url',
  templateUrl: 'wallet-service-url.html'
})
export class WalletServiceUrlPage {
  public success: boolean = false;
  public wallet;
  public comment: string;
  public walletServiceForm: FormGroup;
  private config;
  // private defaults;
  private bwsURLOptions;

  public okText: string;
  public cancelText: string;

  constructor(
    private profileProvider: ProfileProvider,
    private navCtrl: NavController,
    private navParams: NavParams,
    private configProvider: ConfigProvider,
    private app: AppProvider,
    private logger: Logger,
    private persistenceProvider: PersistenceProvider,
    private formBuilder: FormBuilder,
    private events: Events,
    private splashScreen: SplashScreen,
    private platformProvider: PlatformProvider,
    private replaceParametersProvider: ReplaceParametersProvider,
    private translate: TranslateService
  ) {
    this.okText = this.translate.instant('Ok');
    this.cancelText = this.translate.instant('Cancel');
    this.walletServiceForm = this.formBuilder.group({
      bwsurl: [
        '',
        Validators.compose([Validators.minLength(1), Validators.required])
      ],
    });
    this.updateBwsURLSelect();
  }

  ionViewDidLoad() {
    this.logger.info('Loaded:  WalletServiceUrlPage');
  }

  ionViewWillEnter() {
    this.wallet = this.profileProvider.getWallet(this.navParams.data.walletId);
    // this.defaults = this.configProvider.getDefaults();
    this.config = this.configProvider.get();
    let appName = this.app.info.nameCase;
    this.comment = this.replaceParametersProvider.replace(
      this.translate.instant(
        "{{appName}} depends on Bitcore Wallet Service (BWS) for blockchain information, networking and Copayer synchronization. The default configuration points to https://bwsby.vpubchain.com (Vircle's public BWS instance)."
      ),
      { appName }
    );
    this.walletServiceForm.value.bwsurl =
      (this.config.bwsFor &&
        this.config.bwsFor[this.wallet.credentials.walletId]) ||
      this.wallet.baseUrl;
      // this.defaults.bws.url;

    this.walletServiceForm.controls['bwsurl'].setValue(this.walletServiceForm.value.bwsurl);
  }

  public resetDefaultUrl(): void {
    this.walletServiceForm.value.bwsurl = this.bwsURLOptions[0].id; // this.defaults.bws.url;
  }

  private updateBwsURLSelect(): void {
    this.bwsURLOptions = [];
    var nums: number = 0;
    for (var id in BwsUrl) {
      var obj = {
        id: '',
        label: '',
        supportsTestnet: true
      };
      obj.id = BwsUrl[id];
      this.bwsURLOptions.push(obj);
      nums ++;
    }
    nums = 0;
    for (var name in BwsName) {
      this.bwsURLOptions[nums].label = BwsName[name];
      nums ++;
    }
  }

  public bwsURLOptionsChange(bwsurl: string): void {
    this.walletServiceForm.value.bwsurl = bwsurl;
  }

  public save(): void {
    let bws;
    switch (this.walletServiceForm.value.bwsurl) {
      case 'prod':
      case 'production':
        bws = 'https://bws.vpubchain.com/bws/api';
        break;
      case 'sta':
      case 'staging':
        bws = 'https://bws-staging.b-pay.net/bws/api';
        break;
      case 'loc':
      case 'local':
        bws = 'https://bws.vpubchain.com/bws/api';
        break;
    }
    if (bws) {
      this.logger.info('Using BWS URL Alias to ' + bws);
      this.walletServiceForm.value.bwsurl = bws;
    }

    let opts = {
      bwsFor: {}
    };
    opts.bwsFor[
      this.wallet.credentials.walletId
    ] = this.walletServiceForm.value.bwsurl;

    this.configProvider.set(opts);
    this.persistenceProvider.setCleanAndScanAddresses(
      this.wallet.credentials.walletId
    );
    this.events.publish('wallet:updated', this.wallet.credentials.walletId);
    this.navCtrl.popToRoot().then(() => {
      this.reload();
    });
  }

  private reload(): void {
    window.location.reload();
    if (this.platformProvider.isCordova) this.splashScreen.show();
  }
}
