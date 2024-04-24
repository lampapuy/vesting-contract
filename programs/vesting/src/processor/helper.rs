use super::*;

// Function to calculate next pay date by given date and frequency
pub fn calc_next_pay_date(timestamp: i64, freq: u32) -> i64 {
    timestamp + (i64::from(freq) * MONTHLY_TIMESTAMP)
}

// Function to calculate payable amount
pub fn calc_pay_amount(amount: u128, rate: u128, decimals: u32) -> u128 {
    // Considering 2 decimals extra for percentage total
    (amount * rate) / 10_u128.pow(decimals + 2)
}
