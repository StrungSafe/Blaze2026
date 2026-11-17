
export const ADMIN_WALLET_ADDRESSES: string[] = [
  "", // Admin 1
  "", // Admin 2
  "", // Admin 3
];

export const isAdminWallet = (address?: string | null): boolean => {
  if (!address) return false;

  return ADMIN_WALLET_ADDRESSES.some(
    (adminAddress) =>
      adminAddress.trim() !== "" &&
      adminAddress.trim().toLowerCase() === address.trim().toLowerCase()
  );
};

export const isAdminAccessConfigured = (): boolean =>
  ADMIN_WALLET_ADDRESSES.filter((address) => address.trim() !== "").length === 3;
