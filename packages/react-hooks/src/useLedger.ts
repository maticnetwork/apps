// Copyright 2017-2025 @polkadot/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

// This is for the use of `Ledger`
//
/* eslint-disable deprecation/deprecation */

import type { ApiPromise } from '@polkadot/api';
import type { TransportType } from '@polkadot/hw-ledger-transports/types';

import { useCallback, useMemo } from 'react';

import { Ledger, LedgerGeneric } from '@polkadot/hw-ledger';
import { knownGenesis, knownLedger } from '@polkadot/networks/defaults';
import { settings } from '@polkadot/ui-settings';
import { assert } from '@polkadot/util';

import { createNamedHook } from './createNamedHook.js';
import { useApi } from './useApi.js';

interface StateBase {
  hasLedgerChain: boolean;
  hasWebUsb: boolean;
  isLedgerCapable: boolean;
  isLedgerEnabled: boolean;
}

interface State extends StateBase {
  getLedger: () => LedgerGeneric | Ledger;
}

const EMPTY_STATE: StateBase = {
  hasLedgerChain: false,
  hasWebUsb: false,
  isLedgerCapable: false,
  isLedgerEnabled: false
};

const availGenesis: typeof knownGenesis = {
  avail: ['0xb91746b45e0346cc2f815a520b9c6cb4d5c0902af848db0a80f85932d2e8276a'],
  'avail-hex': ['0x9d5ea6a5d7631e13028b684a1a0078e3970caa78bd677eaecaf2160304f174fb'],
  'avail-turing': ['0xd3d2f3a3495dc597434a99d7d449ebad6616db45e4e4f178f31cc6fa14378b70']
};
const newKnownGenesis: typeof knownGenesis = {
  ...knownGenesis,
  ...availGenesis
};

const availLedger: typeof knownLedger = {
  avail: 0x800002c5,
  'avail-hex': 0x800002c5,
  'avail-turing': 0x800002c5
};
const newKnownLedger: typeof knownLedger = {
  ...knownLedger,
  ...availLedger
};

const hasWebUsb = !!(window as unknown as { USB?: unknown }).USB;
const ledgerChains = Object
  .keys(newKnownGenesis)
  .filter((n) => newKnownLedger[n]);
const ledgerHashes = ledgerChains.reduce<string[]>((all, n) => [...all, ...newKnownGenesis[n]], []);
let ledger: LedgerGeneric | Ledger | null = null;
let ledgerType: TransportType | null = null;

function retrieveLedger (api: ApiPromise): LedgerGeneric | Ledger {
  const currType = settings.get().ledgerConn as TransportType;
  const currApp = 'chainSpecific' as string; // settings.get().ledgerApp;

  if (!ledger || ledgerType !== currType) {
    const genesisHex = api.genesisHash.toHex();
    const network = ledgerChains.find((network) => newKnownGenesis[network].includes(genesisHex));

    assert(network, `Unable to find a known Ledger config for genesisHash ${genesisHex}`);

    if (currApp === 'generic') {
      // All chains use the `slip44` from polkadot in their derivation path in ledger.
      // This interface is specific to the underlying PolkadotGenericApp.
      ledger = new LedgerGeneric(currType, network, newKnownLedger.polkadot);
    } else if (currApp === 'migration') {
      ledger = new LedgerGeneric(currType, network, newKnownLedger[network]);
    } else if (currApp === 'chainSpecific') {
      ledger = new Ledger(currType, network);
    } else {
      // This will never get touched since it will always hit the above two. This satisfies the compiler.
      ledger = new LedgerGeneric(currType, network, newKnownLedger.polkadot);
    }

    ledgerType = currType;
  }

  return ledger;
}

function getState (api: ApiPromise): StateBase {
  const hasLedgerChain = ledgerHashes.includes(api.genesisHash.toHex());
  const isLedgerCapable = hasWebUsb && hasLedgerChain;

  return {
    hasLedgerChain,
    hasWebUsb,
    isLedgerCapable,
    isLedgerEnabled: isLedgerCapable && settings.ledgerConn !== 'none'
  };
}

function useLedgerImpl (): State {
  const { api, isApiReady } = useApi();

  const getLedger = useCallback(
    () => retrieveLedger(api),
    [api]
  );

  return useMemo(
    () => ({ ...(isApiReady ? getState(api) : EMPTY_STATE), getLedger }),
    [api, getLedger, isApiReady]
  );
}

export const useLedger = createNamedHook('useLedger', useLedgerImpl);
