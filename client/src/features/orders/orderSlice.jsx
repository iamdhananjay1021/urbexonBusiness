// src/features/orders/orderSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as orderApi from "../../api/orderApi";

export const getMyOrders = createAsyncThunk(
    "orders/getMyOrders",
    async (_, { rejectWithValue }) => {
        try {
            const { data } = await orderApi.getMyOrders();
            return data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message || "Failed to fetch orders"
            );
        }
    },
    { condition: (_, { getState }) => getState().orders.status !== "loading" }
);

const orderSlice = createSlice({
    name: "orders",
    initialState: {
        orders: [],
        status: "idle",
        error: null,
        lastFetched: null,
    },
    reducers: {
        clearOrders: (state) => {
            state.orders = [];
            state.status = "idle";
            state.error = null;
            state.lastFetched = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getMyOrders.pending, (state) => {
                state.status = "loading";
                state.error = null;
            })
            .addCase(getMyOrders.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.orders = action.payload;
                state.lastFetched = Date.now();
            })
            .addCase(getMyOrders.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
                // Don't wipe orders on transient failures — keep cached data
            });
    },
});

export const { clearOrders } = orderSlice.actions;
export default orderSlice.reducer;