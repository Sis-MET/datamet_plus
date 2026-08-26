import { useEffect, useState } from 'react';
import { createTaskTooltipStore, TaskTooltipContext } from './taskTooltipStore';

export function TaskTooltipProvider({ children }) {
  const [store] = useState(() => createTaskTooltipStore());
  useEffect(() => () => store.destroy(), [store]);

  return (
    <TaskTooltipContext.Provider value={store}>
      {children}
    </TaskTooltipContext.Provider>
  );
}
