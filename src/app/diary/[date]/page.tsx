import { DiaryPageClient } from "./diary-page-client";

interface PageProps {
  params: Promise<{ date: string }>;
}

export default async function DiaryPage({ params }: PageProps) {
  const { date } = await params;
  return <DiaryPageClient dateParam={date} />;
}
