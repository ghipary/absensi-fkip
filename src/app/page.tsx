import { redirect } from "next/navigation";

/** Fallback — middleware biasanya sudah me-redirect `/` ke dashboard role. */
export default function Home() {
  redirect("/login");
}
