import { Provider } from "../../models/provider.model";
import { AppError } from "../../types/errors";
import {
  CreateProviderDtoType,
  UpdateProviderDtoType,
} from "./provider.schema";
import { slotService } from "../slot/slot.service";

export async function createProvider(
  userId: string,
  dto: CreateProviderDtoType,
) {
  const existing = await Provider.findOne({ userId });
  if (existing) {
    throw new AppError(
      "DUPLICATE_KEY",
      409,
      "Provider profile already exists for this user",
    );
  }

  const provider = await Provider.create({ userId, ...dto });
  return provider;
}

export async function getProviderById(providerId: string) {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    throw new AppError("NOT_FOUND", 404, "Provider not found");
  }
  return provider;
}

export async function updateProvider(
  providerId: string,
  userId: string,
  dto: UpdateProviderDtoType,
) {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    throw new AppError("NOT_FOUND", 404, "Provider not found");
  }

  if (provider.userId.toString() !== userId) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "You do not own this provider profile",
    );
  }

  Object.assign(provider, dto);
  await provider.save();
  return provider;
}

export async function generateProviderSlots(
  providerId: string,
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  return slotService.generateSlots(providerId, userId, startDate, endDate);
}
