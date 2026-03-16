import { Prisma } from "@prisma/client";
import { generateSnowflakeId } from "./snowflake";

type PrismaIdFieldType = "String" | "BigInt";

const fieldTypeCache = new Map<string, PrismaIdFieldType>();

function getIdFieldType(
  modelName: string,
  fieldName: string,
): PrismaIdFieldType {
  const cacheKey = `${modelName}.${fieldName}`;
  const cached = fieldTypeCache.get(cacheKey);
  if (cached) return cached;

  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === modelName);
  const field = model?.fields.find((entry) => entry.name === fieldName);
  const fieldType = field?.type === "String" ? "String" : "BigInt";
  fieldTypeCache.set(cacheKey, fieldType);
  return fieldType;
}

function normalizeId(id: string | number | bigint): bigint {
  return typeof id === "bigint" ? id : BigInt(id);
}

export function toPrismaId(
  modelName: string,
  fieldName: string,
  id: string | number | bigint,
): string | bigint {
  const normalizedId = normalizeId(id);
  return getIdFieldType(modelName, fieldName) === "String"
    ? normalizedId.toString()
    : normalizedId;
}

export function generatePrismaId(modelName: string): string | bigint {
  return toPrismaId(modelName, "id", generateSnowflakeId());
}
