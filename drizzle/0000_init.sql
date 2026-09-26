CREATE SCHEMA IF NOT EXISTS "inventory";
--> statement-breakpoint
CREATE TABLE "inventory"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."category" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."location" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"warehouse_id" text,
	"parent_id" text,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"type" text NOT NULL,
	"system_key" text,
	"barcode" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."operation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"reference" text NOT NULL,
	"type" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"source_location_id" text NOT NULL,
	"dest_location_id" text NOT NULL,
	"partner" text,
	"note" text,
	"created_by_id" text,
	"validated_by_id" text,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "inventory"."product" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"category_id" text,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
	"uom" text DEFAULT 'pcs' NOT NULL,
	"cost_cents" integer,
	"sale_price_cents" integer,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."reorder_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"location_id" text NOT NULL,
	"min_quantity" numeric(18, 4) DEFAULT 0 NOT NULL,
	"max_quantity" numeric(18, 4) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."sequence" (
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"next" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_move" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"product_id" text NOT NULL,
	"source_location_id" text NOT NULL,
	"dest_location_id" text NOT NULL,
	"quantity" numeric(18, 4) NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_quant" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"location_id" text NOT NULL,
	"quantity" numeric(18, 4) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "inventory"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory"."warehouse" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "inventory"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."category" ADD CONSTRAINT "category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "inventory"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."location" ADD CONSTRAINT "location_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."location" ADD CONSTRAINT "location_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "inventory"."warehouse"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "inventory"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."operation" ADD CONSTRAINT "operation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."operation" ADD CONSTRAINT "operation_source_location_id_location_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "inventory"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."operation" ADD CONSTRAINT "operation_dest_location_id_location_id_fk" FOREIGN KEY ("dest_location_id") REFERENCES "inventory"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."operation" ADD CONSTRAINT "operation_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "inventory"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."operation" ADD CONSTRAINT "operation_validated_by_id_user_id_fk" FOREIGN KEY ("validated_by_id") REFERENCES "inventory"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."product" ADD CONSTRAINT "product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "inventory"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."product" ADD CONSTRAINT "product_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "inventory"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."reorder_rule" ADD CONSTRAINT "reorder_rule_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."reorder_rule" ADD CONSTRAINT "reorder_rule_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."reorder_rule" ADD CONSTRAINT "reorder_rule_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."sequence" ADD CONSTRAINT "sequence_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "inventory"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_move" ADD CONSTRAINT "stock_move_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_move" ADD CONSTRAINT "stock_move_operation_id_operation_id_fk" FOREIGN KEY ("operation_id") REFERENCES "inventory"."operation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_move" ADD CONSTRAINT "stock_move_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_move" ADD CONSTRAINT "stock_move_source_location_id_location_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "inventory"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_move" ADD CONSTRAINT "stock_move_dest_location_id_location_id_fk" FOREIGN KEY ("dest_location_id") REFERENCES "inventory"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_quant" ADD CONSTRAINT "stock_quant_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_quant" ADD CONSTRAINT "stock_quant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "inventory"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."stock_quant" ADD CONSTRAINT "stock_quant_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "inventory"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."warehouse" ADD CONSTRAINT "warehouse_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "inventory"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "inventory"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "category_org_name_uq" ON "inventory"."category" USING btree ("organization_id",coalesce("parent_id", ''),lower("name"));--> statement-breakpoint
CREATE INDEX "invitation_org_idx" ON "inventory"."invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "location_org_idx" ON "inventory"."location" USING btree ("organization_id","type");--> statement-breakpoint
CREATE INDEX "location_parent_idx" ON "inventory"."location" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "location_org_system_uq" ON "inventory"."location" USING btree ("organization_id","system_key") WHERE "inventory"."location"."system_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "location_org_fullname_uq" ON "inventory"."location" USING btree ("organization_id",lower("full_name"));--> statement-breakpoint
CREATE INDEX "member_org_idx" ON "inventory"."member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_idx" ON "inventory"."member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operation_org_ref_uq" ON "inventory"."operation" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "operation_org_state_idx" ON "inventory"."operation" USING btree ("organization_id","state","created_at");--> statement-breakpoint
CREATE INDEX "product_org_idx" ON "inventory"."product" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "product_category_idx" ON "inventory"."product" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_sku_uq" ON "inventory"."product" USING btree ("organization_id",lower("sku")) WHERE "inventory"."product"."sku" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_barcode_uq" ON "inventory"."product" USING btree ("organization_id","barcode") WHERE "inventory"."product"."barcode" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reorder_product_location_uq" ON "inventory"."reorder_rule" USING btree ("product_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sequence_org_code_uq" ON "inventory"."sequence" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "inventory"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "move_product_idx" ON "inventory"."stock_move" USING btree ("product_id","done_at");--> statement-breakpoint
CREATE INDEX "move_operation_idx" ON "inventory"."stock_move" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "move_org_done_idx" ON "inventory"."stock_move" USING btree ("organization_id","done_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quant_product_location_uq" ON "inventory"."stock_quant" USING btree ("product_id","location_id");--> statement-breakpoint
CREATE INDEX "quant_org_location_idx" ON "inventory"."stock_quant" USING btree ("organization_id","location_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "inventory"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_org_code_uq" ON "inventory"."warehouse" USING btree ("organization_id","code");