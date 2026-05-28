
export const currentUser = function(req,res){
    return res.status(200).json(req.user);
}