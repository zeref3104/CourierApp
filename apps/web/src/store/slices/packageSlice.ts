import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PackageState {
  list: any[];
  current: any | null;
  total: number;
  loading: boolean;
}

const initialState: PackageState = {
  list: [],
  current: null,
  total: 0,
  loading: false,
};

const packageSlice = createSlice({
  name: 'packages',
  initialState,
  reducers: {
    setPackages(state, action: PayloadAction<{ data: any[]; total: number }>) {
      state.list = action.payload.data;
      state.total = action.payload.total;
      state.loading = false;
    },
    setCurrentPackage(state, action: PayloadAction<any>) {
      state.current = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setPackages, setCurrentPackage, setLoading } = packageSlice.actions;
export default packageSlice.reducer;