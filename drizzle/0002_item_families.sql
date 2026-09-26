ALTER TABLE "inventory"."product" ADD COLUMN "family_id" text;--> statement-breakpoint
UPDATE "inventory"."product" p SET "family_id" = (
  SELECT min(p2."id") FROM "inventory"."product" p2
  WHERE p2."organization_id" = p."organization_id" AND lower(p2."name") = lower(p."name")
);--> statement-breakpoint
ALTER TABLE "inventory"."product" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "product_family_idx" ON "inventory"."product" USING btree ("organization_id","family_id");
