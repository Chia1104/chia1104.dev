import { ScrollShadow } from "@heroui/react";
import "server-only";
import dayjs from "dayjs";

import { getContributions } from "@chia/api/github";
import meta from "@chia/meta";
import { cn } from "@chia/ui/utils/cn.util";

import { ContributionsChart as ContributionsChartComponent } from "@/components/project/contributions-chart";

const levelConverter = (count: number) => {
  if (count === 0) return 0;
  if (count <= 4) return 1;
  if (count <= 9) return 2;
  if (count <= 14) return 3;
  return 4;
};

export const ContributionsChart = async () => {
  const contributions = await getContributions(
    meta.name,
    dayjs().subtract(1, "year").toISOString(),
    dayjs().toISOString()
  );
  return (
    <ScrollShadow
      orientation="horizontal"
      className={cn(
        "my-6 flex w-full justify-center",
        "[--activity-0:#ebedf0] [--activity-1:#9be9a8] [--activity-2:#40c463] [--activity-3:#30a14e] [--activity-4:#216e39]",
        "dark:[--activity-0:#252525] dark:[--activity-1:#033a16] dark:[--activity-2:#196c2e] dark:[--activity-3:#2ea043] dark:[--activity-4:#56d364]"
      )}>
      <ContributionsChartComponent
        data={contributions.user.contributionsCollection.contributionCalendar.weeks
          .flatMap((week) => week.contributionDays)
          .map((day) => ({
            date: day.date,
            count: day.contributionCount,
            level: levelConverter(day.contributionCount),
          }))}
      />
    </ScrollShadow>
  );
};
