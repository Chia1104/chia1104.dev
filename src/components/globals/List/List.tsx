import { FC, ReactNode } from 'react';
import type { ListItemType } from '@chia/utils/types/list_item';

interface Props {
  item: ListItemType;
}

export const List: FC<Props> = ({ item }) => {
  return (
    <ul className="py-1 px-2">
      {
        // @ts-ignore
        item.map((item: ListItemType) => (
          <li key={item.id} className="my-1">{item.data}</li>
        ))
      }
    </ul>
  );
};
