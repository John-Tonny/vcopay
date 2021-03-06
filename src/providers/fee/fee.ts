import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Logger } from '../../providers/logger/logger';

// providers
import { BwcProvider } from '../../providers/bwc/bwc';
import { ConfigProvider } from '../../providers/config/config';

import * as _ from 'lodash';

@Injectable()
export class FeeProvider {
  private CACHE_TIME_TS: number = 60;
  private cache: {
    updateTs: number;
    coin: string;
    data?: any;
  } = {
    updateTs: 0,
    coin: ''
  };

  constructor(
    private configProvider: ConfigProvider,
    private logger: Logger,
    private bwcProvider: BwcProvider,
    private translate: TranslateService
  ) {
    this.logger.debug('FeeProvider initialized');
  }

  public getFeeOpts() {
    const feeOpts = {
      urgent: this.translate.instant('Urgent'),
      priority: this.translate.instant('Priority'),
      normal: this.translate.instant('Normal'),
      economy: this.translate.instant('Economy'),
      superEconomy: this.translate.instant('Super Economy'),
      custom: this.translate.instant('Custom')
    };
    return feeOpts;
  }

  public getCurrentFeeLevel(): string {
    return this.configProvider.get().wallet.settings.feeLevel || 'normal';
  }

  public getFeeRate(
    coin: string,
    network: string,
    feeLevel: string,
    opts?
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (feeLevel == 'custom') return resolve();
      network = network || 'livenet';
      this.getFeeLevels(coin, opts)
        .then(response => {
          let feeLevelRate;

          if (response.fromCache) {
            feeLevelRate = _.find(response.levels[network], o => {
              return o.level == feeLevel;
            });
          } else {
            feeLevelRate = _.find(response.levels[network], o => {
              return o.level == feeLevel;
            });
          }
          if (!feeLevelRate || !feeLevelRate.feePerKb) {
            let msg =
              this.translate.instant('Could not get dynamic fee for level:') +
              ' ' +
              feeLevel;
            return reject(msg);
          }

          let feeRate = feeLevelRate.feePerKb;
          if (!response.fromCache)
            this.logger.debug(
              'Dynamic fee: ' +
                feeLevel +
                '/' +
                network +
                ' ' +
                (feeLevelRate.feePerKb / 1000).toFixed() +
                ' SAT/B'
            );
          return resolve(feeRate);
        })
        .catch(err => {
          return reject(err);
        });
    });
  }

  public getCurrentFeeRate(coin: string, network: string, opts?): Promise<any> {
    return new Promise((resolve, reject) => {
      this.getFeeRate(coin, network, this.getCurrentFeeLevel(), opts)
        .then((data: number) => {
          return resolve(data);
        })
        .catch(err => {
          return reject(err);
        });
    });
  }

  public getFeeLevels(coin: string, opts?): Promise<any> {
    return new Promise((resolve, reject) => {
      coin = coin || 'btc';

      if (
        this.cache.coin == coin &&
        this.cache.updateTs > Date.now() - this.CACHE_TIME_TS * 1000
      ) {
        return resolve({ levels: this.cache.data, fromCache: true });
      }

      let walletClient = this.bwcProvider.getClient(null, opts );

      walletClient.getFeeLevels(
        coin,
        'livenet',
        (errLivenet, levelsLivenet) => {
          if (errLivenet) {
            return reject(this.translate.instant('Could not get dynamic fee'));
          }
          walletClient.getFeeLevels(
            coin,
            'testnet',
            (errTestnet, levelsTestnet) => {
              if (errTestnet) {
                return reject(
                  this.translate.instant('Could not get dynamic fee')
                );
              }
              this.cache.updateTs = Date.now();
              this.cache.coin = coin;
              this.cache.data = {
                livenet: levelsLivenet,
                testnet: levelsTestnet
              };
              return resolve({ levels: this.cache.data });
            }
          );
        }
      );
    });
  }

  public getEstimatedFee(wallet, txp): Promise<any> {
    return new Promise((resolve, reject) => {
      this.getCurrentFeeRate(wallet.coin, wallet.network, {'bwsurl': wallet.baseUrl})
        .then(feePerKB => {
          let txSize = this.getEstimatedSize(wallet, txp);
          let fee = (feePerKB * txSize) / 1000;
          resolve(parseInt(fee.toFixed(0), 10));
        })
        .catch(reject);
    });
  }

  private getEstimatedSize(wallet, txp) {
    // Note: found empirically based on all multisig P2SH inputs and within m & n allowed limits.
    var safetyMargin = 0.02;

    var overhead = 4 + 4 + 9 + 9;
    var inputSize = this.getEstimatedSizeForSingleInput(wallet);
    var outputSize = 34;
    var nbInputs = txp.inputs.length;
    var nbOutputs =
      (_.isArray(txp.outputs) ? Math.max(1, txp.outputs.length) : 1) + 1;

    var size = overhead + inputSize * nbInputs + outputSize * nbOutputs;

    return parseInt((size * (1 + safetyMargin)).toFixed(0), 10);
  }

  private getEstimatedSizeForSingleInput(wallet) {
    switch (wallet.addressType) {
      case 'P2PKH':
        return 147;
      default:
      case 'P2SH':
        return wallet.m * 72 + wallet.n * 36 + 44;
    }
  }
}
