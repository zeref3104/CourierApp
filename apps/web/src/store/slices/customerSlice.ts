import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CustomerState {
  list: any[];
  current: any | null;
  total: number;
  loading: boolean;
  searchResults: any[];
  searchLoading: boolean;
}

const initialState: CustomerState = {
  list: [],
  current: null,
  total: 0,
  loading: false,
  searchResults: [],
  searchLoading: false,
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
    setSearchResults(state, action: PayloadAction<any[]>) {
      state.searchResults = action.payload;
      state.searchLoading = false;
    },
    setSearchLoading(state, action: PayloadAction<boolean>) {
      state.searchLoading = action.payload;
    },
    clearSearchResults(state) {
      state.searchResults = [];
      state.searchLoading = false;
    },
  },
});

export const { setCustomers, setCurrentCustomer, setLoading, setSearchResults, setSearchLoading, clearSearchResults } = customerSlice.actions;
export default customerSlice.reducer;