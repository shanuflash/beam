import { ReceiverView } from "./receiver-view";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function ReceiverPage({ params }: Props) {
  const { sessionId } = await params;
  return <ReceiverView sessionId={sessionId} />;
}
