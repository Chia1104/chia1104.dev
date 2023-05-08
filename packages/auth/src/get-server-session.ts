import { getServerSession as _ } from "next-auth";
import authOptions from "./auth-options";

export default function getServerSession() {
  return _(authOptions);
}
