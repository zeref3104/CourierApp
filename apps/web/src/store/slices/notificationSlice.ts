import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface NotificationState {
  unreadCount: number;
  list: any[];
}

const initialState: NotificationState = {
  unreadCount: 0,
  list: [],
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
    setNotifications(state, action: PayloadAction<any[]>) {
      state.list = action.payload;
    },
  },
});

export const { setUnreadCount, setNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;