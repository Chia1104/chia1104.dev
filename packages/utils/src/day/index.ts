import "dayjs/locale/en.js";
import "dayjs/locale/zh-tw.js";

import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat.js";
import duration from "dayjs/plugin/duration.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import tz from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import weekOfYear from "dayjs/plugin/weekOfYear.js";

dayjs.extend(localizedFormat);
dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(weekOfYear);
dayjs.extend(advancedFormat);

export default dayjs;
