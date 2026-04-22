import { JoinForm } from './JoinForm'

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JoinForm roomId={id} />
}
