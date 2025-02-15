import { useState } from "react";
import { api } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EnhancedClassroomForm } from "../classroom/EnhancedClassroomForm";
import { useToast } from "@/components/ui/use-toast";
import type { Room } from "@prisma/client";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RoomManagementProps {
	wingId: string;
}

interface DataTableRow {
	original: Room;
}


export const RoomManagement = ({ wingId }: RoomManagementProps) => {
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
	const { toast } = useToast();

	const { data: rooms, refetch } = api.room.getAll.useQuery({ wingId });
	const deleteMutation = api.room.delete.useMutation({
		onSuccess: () => {
			toast({
				title: "Room deleted",
				description: "The room has been deleted successfully",
			});
			refetch();
		},
	});

	const handleEdit = (room: Room) => {
		setSelectedRoom(room);
		setIsFormOpen(true);
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteMutation.mutateAsync({ id });
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to delete room",
				variant: "destructive",
			});
		}
	};

	const columns = [
		{
			accessorKey: "number",
			header: "Room Number",
		},
		{
			accessorKey: "type",
			header: "Type",
			cell: ({ row }: { row: DataTableRow }) => {
				const type = row.original.type;
				return type.replace(/_/g, " ");
			},
		},
		{
			accessorKey: "capacity",
			header: "Capacity",
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }: { row: DataTableRow }) => {
				const status = row.original.status;
				return (
					<Badge variant={status === "ACTIVE" ? "success" : "destructive"}>
						{status}
					</Badge>
				);
			},
		},
		{
			id: "actions",
			cell: ({ row }: { row: DataTableRow }) => {
				const room = row.original;
				return (
					<DropdownMenu>
						<DropdownMenuTrigger>
							<MoreHorizontal className="h-4 w-4" />
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem onClick={() => handleEdit(room)}>
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => handleDelete(room.id)}>
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
		},
	];

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-semibold">Rooms</h2>
				<Button onClick={() => setIsFormOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Add Room
				</Button>
			</div>

			<DataTable
				columns={columns}
				data={rooms || []}
			/>

			<EnhancedClassroomForm
				isOpen={isFormOpen}
				onClose={() => {
					setIsFormOpen(false);
					setSelectedRoom(null);
				}}
				room={selectedRoom}
				onSuccess={() => {
					setIsFormOpen(false);
					setSelectedRoom(null);
					refetch();
				}}
			/>
		</div>
	);
};