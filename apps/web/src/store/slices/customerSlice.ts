import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CustomerState {
  list: any[];
  current: any | null;
  total: number;
  loading: boolean;
}

const initialState: CustomerState = {
  list: [],
  current: null,
  total: 0,
  loading: false,
};

const customerSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    setCustomers(state, action: PayloadAction<{ data: any[]; total: number }>) {
      state.list = action.payload.data;
      state.total = action.payload.total;
      state.loading = false;
    },
    setCurrentCustomer(state, action: PayloadAction<any>) {
      state.current = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setCustomers, setCurrentCustomer, setLoading } = customerSlice.actions;
export default customerSlice.reducer;