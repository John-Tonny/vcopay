import development from './dev';
import { EnvironmentSchema } from './schema';

export const port = 8013;
export const host = `http://localhost:${port}`;

/**
 * Environment: e2e
 */
const env: EnvironmentSchema = {
  // Start with development config,
  ...development,
  // override for e2e testing:
  name: 'e2e',
  enableAnimations: false,
  ratesAPI: {
    btc: `${host}/bitpay.com/api/rates`,
    bch: `${host}/bitpay.com/api/rates/bch`,
    part: `${host}/api.coinmarketcap.com/v1/ticker/particl`
  },
  activateScanner: false
};

export default env;
