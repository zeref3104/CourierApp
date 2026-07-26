import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  socketConnected: boolean;
}

const initialState: UiState = {
  theme: 'light',
  sidebarCollapsed: false,
  sidebarOpen: false,
  socketConnected: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<string>) {
      state.theme = action.payload as 'light' | 'dark';
    },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    openSidebar(state) {
      state.sidebarOpen = true;
    },
    closeSidebar(state) {
      state.sidebarOpen = false;
    },
    toggleSidebarMobile(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.socketConnected = action.payload;
    },
  },
});

export const { setTheme, toggleTheme, toggleSidebar, setSidebarCollapsed, openSidebar, closeSidebar, toggleSidebarMobile, setSocketConnected } = uiSlice.actions;
export default uiSlice.reducer;