// Copyright 2017-2025 @polkadot/app-broker authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { CoreWorkloadType, CoreWorkplanType, InfoRow } from './types.js';

import { CoreTimeConsts, type CoreWorkload, type LegacyLease, type RegionInfo, type Reservation } from '@polkadot/react-hooks/types';
import { BN } from '@polkadot/util';

import { CoreTimeTypes } from './types.js';

function formatDate (date: Date) {
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * blockTime = 6000 ms
 * BlocksPerTimeslice = 80
 * Default Regoin = 5040 timeslices
 * TargetBlock = TargetTimeslice * BlocksPerTimeslice
 * Block Time Difference = |TargetBlock - latest Block| * blockTime
 *
 * Estimate timestamp =
 * if targetBlock is before the latestBlock
 *    now minus block time difference
 * else
 *    now plus block time difference
 */
export const estimateTime = (targetTimeslice: string | number, latestBlock: number): string | null => {
  if (!latestBlock || !targetTimeslice) {
    console.error('Invalid input: one or more inputs are missing');

    return null;
  }

  const now = new Date().getTime();

  try {
    const blockTime = new BN(CoreTimeConsts.BlockTime); // Average block time in milliseconds (6 seconds)
    const timeSlice = new BN(CoreTimeConsts.BlocksPerTimeslice);
    const latestBlockBN = new BN(latestBlock);
    const timestampBN = new BN(now);
    const targetBlockBN = new BN(targetTimeslice).mul(timeSlice);
    const blockTimeDifference = targetBlockBN.sub(latestBlockBN).mul(blockTime);
    const estTimestamp = timestampBN.add(blockTimeDifference);

    return formatDate(new Date(estTimestamp.toNumber()));
  } catch (error) {
    console.error('Error in calculation:', error);

    return null;
  }
};

/**
 *
 * @param data: CoreWorkloadType[]
 * @param core: core number
 * @param currentRegion
 * @param timeslice
 * @param param4
 * @param regionLength
 */
export function formatRowInfo (data: CoreWorkloadType[] | CoreWorkplanType[], core: number, currentRegion: RegionInfo | undefined, currentTimeSlice: number, { regionBegin, regionEnd }: { regionBegin: number, regionEnd: number }, regionLength: number): InfoRow[] {
  return data.map((one: CoreWorkloadType | CoreWorkplanType) => {
    const item: InfoRow = { core, maskBits: one?.info?.maskBits, task: one?.info?.task, type: one?.type };
    const blockNumberNow = currentTimeSlice * 80;

    item.type = one.type;
    let end; let start = null;

    if (one.type === CoreTimeTypes.Lease) {
      const period = Math.floor(one.lastBlock / regionLength);

      end = period * regionLength;
    } else {
      start = currentRegion?.start?.toString() ?? regionBegin;
      end = currentRegion?.end?.toString() ?? regionEnd;
    }

    item.owner = currentRegion?.owner.toString();
    item.start = start ? estimateTime(start, blockNumberNow) : null;
    item.end = end ? estimateTime(end, blockNumberNow) : null;
    item.endBlock = end ? Number(end) * 80 : 0;

    if ('timeslice' in one && !start) {
      start = estimateTime(one.timeslice, blockNumberNow) ?? null;
    }

    return item;
  });
}

export function getStats (totalCores: string | undefined, workloadInfos: CoreWorkload[] | undefined) {
  if (!totalCores || !workloadInfos) {
    return { idles: 0, pools: 0, tasks: 0 };
  }

  const { pools, tasks } = workloadInfos.reduce(
    (acc, { info }) => {
      if (info.isTask) {
        acc.tasks += 1;
      } else if (info.isPool) {
        acc.pools += 1;
      }

      return acc;
    },
    { pools: 0, tasks: 0 }
  );
  const idles = Number(totalCores) - (pools + tasks);

  return { idles, pools, tasks };
}

export const createTaskMap = <T extends { task: string }>(items: T[]): Record<number, T> => {
  return (items || []).reduce((acc, item) => {
    acc[Number(item.task)] = item;

    return acc;
  }, {} as Record<number, T>);
};

export const getOccupancyType = (lease: LegacyLease | undefined, reservation: Reservation | undefined, isPool: boolean): CoreTimeTypes => {
  if (isPool) {
    return CoreTimeTypes['On Demand'];
  }

  return reservation ? CoreTimeTypes.Reservation : lease ? CoreTimeTypes.Lease : CoreTimeTypes['Bulk Coretime'];
};
