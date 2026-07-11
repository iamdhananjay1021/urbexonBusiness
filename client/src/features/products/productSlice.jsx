// orderSlice.js — bilkul sahi hai ✅ koi change nahi

// productSlice.js — improved version:
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getProducts } from "../../api/productApi";
export const fetchProducts = createAsyncThunk(
    "products/fetchProducts",
    async ({ search = "", category = "", deals = "" } = {}, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams();
            if (search) params.append("search", search);
            if (category) params.append("category", category);
            if (deals) params.append("deals", deals);

            const { data } = await getProducts(`?${params}`);
            return data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message || "Failed to fetch products"
            );
        }
    }
);

const productSlice = createSlice({
    name: "products",
    initialState: {
        items: [],
        status: "idle", // idle | loading | success | failed
        error: null,
    },
    reducers: {
        clearProducts: (state) => {
            state.items = [];
            state.status = "idle";
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProducts.pending, (state) => {
                state.status = "loading";
                state.error = null;
            })
            .addCase(fetchProducts.fulfilled, (state, action) => {
                state.items = action.payload;
                state.status = "success";
            })
            .addCase(fetchProducts.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
                state.items = [];
            });
    },
});

export const { clearProducts } = productSlice.actions;
export default productSlice.reducer;