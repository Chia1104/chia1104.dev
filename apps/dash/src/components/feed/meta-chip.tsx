import { Chip, Tooltip } from "@heroui/react";
import {
  BoxesIcon,
  CloudIcon,
  CircleMinus,
  CircleCheck,
  Circle,
} from "lucide-react";

import type { Locale } from "@chia/db/types";
import dayjs from "@chia/utils/day";

export interface MetaChipProps {
  embedding?: Partial<Record<Locale, boolean>>;
  algolia?: Partial<Record<Locale, boolean>>;
  deleted?: string | null;
  published?: boolean;
}

export const MetaChip = ({
  embedding,
  algolia,
  deleted,
  published,
}: MetaChipProps) => (
  <Chip size="lg">
    <Tooltip delay={500}>
      <Tooltip.Trigger>
        {Object.values(embedding ?? {}).some(Boolean) ? (
          <BoxesIcon className="text-primary size-4" />
        ) : (
          <BoxesIcon className="text-muted-foreground size-4" />
        )}
      </Tooltip.Trigger>
      <Tooltip.Content>
        {Object.entries(embedding ?? {}).map(([locale, value]) => (
          <div key={locale} className="flex items-center gap-1 text-xs">
            {value ? (
              <CircleCheck className="text-success size-2.5" />
            ) : (
              <Circle className="text-muted-foreground size-2.5" />
            )}
            <span className="text-xs">{locale}</span>
          </div>
        ))}
      </Tooltip.Content>
    </Tooltip>
    {algolia ? (
      <CloudIcon className="text-primary size-4" />
    ) : (
      <CloudIcon className="text-muted-foreground size-4" />
    )}
    {deleted ? (
      <Tooltip delay={500}>
        <Tooltip.Trigger>
          <CircleMinus className="text-danger size-4" />
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p className="text-xs">
            Deleted At: {dayjs(deleted).format("MMMM D, YYYY")}
          </p>
        </Tooltip.Content>
      </Tooltip>
    ) : published ? (
      <CircleCheck className="text-success size-4" />
    ) : (
      <Circle className="text-muted-foreground size-4" />
    )}
  </Chip>
);
