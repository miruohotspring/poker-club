import EnterRoomForm from '@/components/layout/enter-room-form';
import { getRecentRooms } from '@/server/actions/get-recent-rooms';

export default async function Page() {
  const recentRooms = await getRecentRooms();

  return (
    <>
      <EnterRoomForm recentRooms={recentRooms} />
    </>
  );
}
